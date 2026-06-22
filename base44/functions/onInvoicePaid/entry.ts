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

    // Only process when status is "Paid"
    if (!data || data.status !== 'Paid') {
      return Response.json({ message: 'Invoice not marked as Paid, skipping' });
    }

    // Skip if a custom sale is already linked (idempotent)
    if (data.custom_sale_id) {
      return Response.json({ message: 'Custom sale already linked, skipping' });
    }

    // Create the CustomSale record for revenue tracking
    const saleDate = data.invoice_date || new Date().toISOString().split('T')[0];
    const customSale = await base44.asServiceRole.entities.CustomSale.create({
      owner_user_id: data.owner_user_id,
      date: saleDate,
      vendor: data.customer_name || '',
      description: `${data.project_name || 'Invoice'} — ${data.invoice_number || ''}`,
      payment_source: data.payment_method || 'Other',
      pre_tax_amount: data.subtotal || 0,
      sales_tax_collected: data.tax_amount || 0,
      gross_sale: data.total || 0,
      shipping_or_postage_cost: data.shipping_cost || 0,
      notes: `Auto-created from invoice ${data.invoice_number || ''}`
    });

    // Link the custom sale back to the invoice to prevent duplicates
    await base44.asServiceRole.entities.Invoice.update(data.id, {
      custom_sale_id: customSale.id
    });

    return Response.json({
      message: 'Custom sale created from paid invoice',
      custom_sale_id: customSale.id,
      invoice_id: data.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});