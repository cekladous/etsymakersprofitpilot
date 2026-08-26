import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { squareFetch, getUserSquareConnection } from "../../shared/squareOauth.ts";

const toCents = (n) => Math.round(Number(n || 0) * 100);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { invoiceId, publish } = await req.json();
    if (!invoiceId) return Response.json({ error: "Missing invoiceId" }, { status: 400 });

    let invoice;
    try {
      invoice = await base44.entities.Invoice.get(invoiceId);
    } catch {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (!invoice || invoice.owner_user_id !== user.id) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Idempotent: already pushed
    if (invoice.square_invoice_id) {
      return Response.json({
        message: "Invoice already in Square",
        square_invoice_id: invoice.square_invoice_id,
        square_customer_id: invoice.square_customer_id,
        already_pushed: true,
      });
    }

    // Use the SELLER'S OWN Square connection — never a shared/fallback account.
    const conn = await getUserSquareConnection(base44, user.id);
    if (!conn) {
      return Response.json(
        {
          error:
            "Connect your own Square account first (Settings → Integrations → Square Account).",
          not_connected: true,
        },
        { status: 400 }
      );
    }
    const accessToken = conn.access_token;

    // 1. Resolve an active location (orders/invoices are location-scoped)
    const locRes = await squareFetch(accessToken, "/v2/locations");
    const locations = (locRes && locRes.locations) || [];
    const location = locations.find((l) => l.status === "ACTIVE") || locations[0];
    if (!location) throw new Error("No Square locations found for your account");
    const locationId = location.id;

    // 2. Find or create the customer by email (fall back to name)
    let customerId = null;
    const email = (invoice.customer_email || "").trim().toLowerCase();
    if (email) {
      const searchRes = await squareFetch(accessToken, "/v2/customers/search", {
        method: "POST",
        body: JSON.stringify({
          query: { filter: { email_address: { exact: email } } },
          limit: 1,
        }),
      });
      customerId = searchRes && searchRes.customers && searchRes.customers[0] && searchRes.customers[0].id;
    }
    if (!customerId) {
      const nameParts = (invoice.customer_name || "Customer").trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";
      const createCust = await squareFetch(accessToken, "/v2/customers", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: `cust-${invoice.id}`,
          given_name: givenName,
          family_name: familyName,
          email_address: email || undefined,
        }),
      });
      customerId = createCust && createCust.customer && createCust.customer.id;
    }
    if (!customerId) throw new Error("Failed to resolve a Square customer");

    // 3. Build the Square order from the invoice line items (+ shipping + tax)
    let lineItems = (invoice.line_items || []).map((li) => ({
      name: li.description || li.product_id || "Item",
      quantity: String(Number(li.quantity || 1)),
      base_price_money: { amount: toCents(li.unit_price), currency: "USD" },
    }));
    if (lineItems.length === 0) {
      // Quotes/invoices carry a total but no itemized lines (the total folds in
      // labor/overhead/markup that isn't in `subtotal`). Use total − tax − shipping
      // so the Square order totals exactly what the customer is charged.
      const itemAmount = Math.max(
        0,
        Number(invoice.total || 0) - Number(invoice.tax_amount || 0) - Number(invoice.shipping_cost || 0)
      );
      lineItems.push({
        name: invoice.project_name || invoice.invoice_number || "Invoice",
        quantity: "1",
        base_price_money: { amount: toCents(itemAmount), currency: "USD" },
      });
    }
    if (Number(invoice.shipping_cost || 0) > 0) {
      lineItems.push({
        name: "Shipping",
        quantity: "1",
        base_price_money: { amount: toCents(invoice.shipping_cost), currency: "USD" },
      });
    }
    const taxes = [];
    if (Number(invoice.tax_amount || 0) > 0) {
      taxes.push({
        name: "Sales Tax",
        percentage: String(Number(invoice.tax_rate || 0)),
        scope: "ORDER",
      });
    }

    // Unique per push so a retry (e.g. after a deleted/failed draft) always
    // builds a fresh OPEN order instead of reusing a stale, non-OPEN one.
    const pushNonce = Date.now();
    const orderRes = await squareFetch(accessToken, "/v2/orders", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `order-${invoice.id}-${pushNonce}`,
        order: {
          location_id: locationId,
          customer_id: customerId,
          line_items: lineItems,
          taxes: taxes,
        },
      }),
    });
    const orderId = orderRes && orderRes.order && orderRes.order.id;
    if (!orderId) throw new Error("Failed to create Square order");

    // 4. Create the Square invoice (draft unless publish=true)
    const todayStr = new Date().toISOString().split("T")[0];
    const dueDate = invoice.due_date && invoice.due_date >= todayStr ? invoice.due_date : todayStr;
    const invoiceRes = await squareFetch(accessToken, "/v2/invoices", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `inv-${invoice.id}-${pushNonce}`,
        invoice: {
          location_id: locationId,
          order_id: orderId,
          primary_recipient: { customer_id: customerId },
          payment_requests: [
            { request_type: "BALANCE", due_date: dueDate, tipping_enabled: false },
          ],
          delivery_method: "EMAIL",
          accepted_payment_methods: {
            card: true,
            square_gift_card: false,
            bank_account: false,
            cash_app_pay: true,
          },
          invoice_number: invoice.invoice_number,
          title: invoice.project_name || undefined,
        },
      }),
    });
    const squareInvoice = invoiceRes && invoiceRes.invoice;
    const squareInvoiceId = squareInvoice && squareInvoice.id;
    if (!squareInvoiceId) throw new Error("Failed to create Square invoice");

    let publicUrl = null;
    let published = false;
    if (publish) {
      const pubRes = await squareFetch(accessToken, `/v2/invoices/${squareInvoiceId}/publish`, {
        method: "POST",
        body: JSON.stringify({ idempotency_key: `pub-${invoice.id}-${pushNonce}` }),
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
      message: published ? "Square invoice created and published" : "Square invoice created (draft)",
      square_invoice_id: squareInvoiceId,
      square_customer_id: customerId,
      public_url: publicUrl,
      published,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}