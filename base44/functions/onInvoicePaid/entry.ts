import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { event, data } = payload;

    // Only process create and update events
    if (!event || (event.type !== 'create' && event.type !== 'update')) {
      return Response.json({ message: 'Not a create/update event, skipping' });
    }

    if (!data || !data.id) {
      return Response.json({ message: 'No entity id in payload, skipping' });
    }

    // SECURITY: Do not trust the payload data — re-fetch the actual invoice
    // from the database and verify its real state. This prevents a direct
    // HTTP caller from forging invoice data (arbitrary amounts, another user's
    // owner_user_id, etc.) to create fraudulent CustomSale records.
    // Entity automations have no user context, so we can't authenticate the
    // caller; instead we verify the invoice's database state directly.
    const invoice = await base44.asServiceRole.entities.Invoice.get(data.id);

    if (!invoice || invoice.status !== 'Paid') {
      return Response.json({ message: 'Invoice not marked as Paid, skipping' });
    }

    // Skip if a custom sale is already linked (idempotent)
    if (invoice.custom_sale_id) {
      return Response.json({ message: 'Custom sale already linked, skipping' });
    }

    // Create the CustomSale record using verified database values
    const saleDate = invoice.invoice_date || new Date().toISOString().split('T')[0];
    const customSale = await base44.asServiceRole.entities.CustomSale.create({
      owner_user_id: invoice.owner_user_id,
      date: saleDate,
      vendor: invoice.customer_name || '',
      description: `${invoice.project_name || 'Invoice'} — ${invoice.invoice_number || ''}`,
      payment_source: invoice.payment_method || 'Other',
      pre_tax_amount: invoice.subtotal || 0,
      sales_tax_collected: invoice.tax_amount || 0,
      gross_sale: invoice.total || 0,
      shipping_or_postage_cost: invoice.shipping_cost || 0,
      notes: `Auto-created from invoice ${invoice.invoice_number || ''}`
    });

    // Link the custom sale back to the invoice to prevent duplicates
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      custom_sale_id: customSale.id
    });

    return Response.json({
      message: 'Custom sale created from paid invoice',
      custom_sale_id: customSale.id,
      invoice_id: invoice.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});