import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SQUARE_VERSION = '2024-08-21';
const SQUARE_API = 'https://connect.squareup.com';

const toCents = (n) => Math.round(Number(n || 0) * 100);

async function squareFetch(token, path, options = {}) {
  const res = await fetch(`${SQUARE_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    const err = (body && body.errors && body.errors[0]) || {};
    throw new Error(err.detail || err.code || `Square API error (${res.status})`);
  }
  return body;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoiceId, publish } = await req.json();
    if (!invoiceId) return Response.json({ error: 'Missing invoiceId' }, { status: 400 });

    let invoice;
    try {
      invoice = await base44.entities.Invoice.get(invoiceId);
    } catch {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (!invoice || invoice.owner_user_id !== user.id) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Idempotent: already pushed
    if (invoice.square_invoice_id) {
      return Response.json({
        message: 'Invoice already in Square',
        square_invoice_id: invoice.square_invoice_id,
        square_customer_id: invoice.square_customer_id,
        already_pushed: true,
      });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('square');

    // 1. Resolve an active location (orders/invoices are location-scoped)
    const locRes = await squareFetch(accessToken, '/v2/locations');
    const locations = (locRes && locRes.locations) || [];
    const location = locations.find((l) => l.status === 'ACTIVE') || locations[0];
    if (!location) throw new Error('No Square locations found for your account');
    const locationId = location.id;

    // 2. Find or create the customer by email (fall back to name)
    let customerId = null;
    const email = (invoice.customer_email || '').trim().toLowerCase();
    if (email) {
      const searchRes = await squareFetch(accessToken, '/v2/customers/search', {
        method: 'POST',
        body: JSON.stringify({
          query: { filter: { email_address: { exact: email } } },
          limit: 1,
        }),
      });
      customerId = searchRes && searchRes.customers && searchRes.customers[0] && searchRes.customers[0].id;
    }
    if (!customerId) {
      const nameParts = (invoice.customer_name || 'Customer').trim().split(/\s+/);
      const givenName = nameParts[0] || '';
      const familyName = nameParts.slice(1).join(' ') || '';
      const createCust = await squareFetch(accessToken, '/v2/customers', {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: `cust-${invoice.id}`,
          given_name: givenName,
          family_name: familyName,
          email_address: email || undefined,
        }),
      });
      customerId = createCust && createCust.customer && createCust.customer.id;
    }
    if (!customerId) throw new Error('Failed to resolve a Square customer');

    // 3. Build the Square order from the invoice line items (+ shipping + tax)
    const lineItems = (invoice.line_items || []).map((li) => ({
      name: li.description || li.product_id || 'Item',
      quantity: String(Number(li.quantity || 1)),
      base_price_money: { amount: toCents(li.unit_price), currency: 'USD' },
    }));
    if (Number(invoice.shipping_cost || 0) > 0) {
      lineItems.push({
        name: 'Shipping',
        quantity: '1',
        base_price_money: { amount: toCents(invoice.shipping_cost), currency: 'USD' },
      });
    }
    const taxes = [];
    if (Number(invoice.tax_amount || 0) > 0) {
      taxes.push({
        name: 'Sales Tax',
        percentage: String(Number(invoice.tax_rate || 0)),
        applied_money: { amount: toCents(invoice.tax_amount), currency: 'USD' },
      });
    }

    const orderRes = await squareFetch(accessToken, '/v2/orders', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: `order-${invoice.id}`,
        order: {
          location_id: locationId,
          customer_id: customerId,
          line_items: lineItems,
          taxes: taxes,
        },
      }),
    });
    const orderId = orderRes && orderRes.order && orderRes.order.id;
    if (!orderId) throw new Error('Failed to create Square order');

    // 4. Create the Square invoice (draft unless publish=true)
    const dueDate = invoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const invoiceRes = await squareFetch(accessToken, '/v2/invoices', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: `inv-${invoice.id}`,
        location_id: locationId,
        order_id: orderId,
        primary_recipient: { customer_id: customerId },
        payment_requests: [
          { request_type: 'BALANCE', due_date: dueDate, tipping_enabled: false },
        ],
        delivery_method: 'EMAIL',
        invoice_number: invoice.invoice_number,
        title: invoice.project_name || undefined,
      }),
    });
    const squareInvoice = invoiceRes && invoiceRes.invoice;
    const squareInvoiceId = squareInvoice && squareInvoice.id;
    if (!squareInvoiceId) throw new Error('Failed to create Square invoice');

    let publicUrl = null;
    let published = false;
    if (publish) {
      const pubRes = await squareFetch(accessToken, `/v2/invoices/${squareInvoiceId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ idempotency_key: `pub-${invoice.id}` }),
      });
      publicUrl = (pubRes && pubRes.invoice && pubRes.invoice.public_url) || null;
      published = true;
    }

    // 5. Persist the Square references back to the invoice
    await base44.entities.Invoice.update(invoice.id, {
      square_invoice_id: squareInvoiceId,
      square_customer_id: customerId,
    });

    return Response.json({
      message: published ? 'Square invoice created and published' : 'Square invoice created (draft)',
      square_invoice_id: squareInvoiceId,
      square_customer_id: customerId,
      public_url: publicUrl,
      published,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}