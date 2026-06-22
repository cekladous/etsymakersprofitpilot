import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { quoteId } = await req.json();
    if (!quoteId) return Response.json({ error: 'Missing quoteId' }, { status: 400 });

    const quote = await base44.entities.Quote.get(quoteId);
    if (!quote || quote.owner_user_id !== user.id) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${random}`;

    const invoice = await base44.entities.Invoice.create({
      owner_user_id: user.id,
      invoice_number: invoiceNumber,
      quote_id: quote.id,
      project_name: quote.project_name,
      customer_id: quote.customer_id || "",
      customer_name: quote.customer_name,
      customer_email: quote.customer_email || "",
      customer_phone: quote.customer_phone || "",
      customer_state: quote.customer_state || "",
      invoice_date: now.toISOString().split('T')[0],
      due_date: quote.due_date || "",
      status: "Sent",
      materials: quote.materials || [],
      machines: quote.machines || [],
      labor_hours: quote.labor_hours || 0,
      labor_minutes: quote.labor_minutes || 0,
      labor_rate: quote.labor_rate || 0,
      shipping_cost: quote.shipping_cost || 0,
      payment_method: quote.payment_method || "",
      line_items: quote.line_items || [],
      subtotal: quote.subtotal || 0,
      tax_rate: quote.tax_rate || 0,
      tax_amount: quote.tax_amount || 0,
      total: quote.total || 0,
      amount_paid: 0,
      balance_due: quote.total || 0,
      notes: quote.notes || "",
    });

    // Update quote status to Invoiced
    const updatedQuote = await base44.entities.Quote.update(quoteId, {
      status: "Invoiced"
    });

    return Response.json({ quote: updatedQuote, invoice });
  } catch (error) {
    console.error('Convert quote to invoice error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});