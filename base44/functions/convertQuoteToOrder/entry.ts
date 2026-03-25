import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { quoteId } = await req.json();
    if (!quoteId) return Response.json({ error: 'Missing quoteId' }, { status: 400 });

    // Get the quote
    const quote = await base44.entities.Quote.get(quoteId);
    if (!quote || quote.owner_user_id !== user.id) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status !== 'Accepted') {
      return Response.json({ error: 'Quote must be Accepted to convert' }, { status: 400 });
    }

    // Create Order
    const order = await base44.entities.Order.create({
      owner_user_id: user.id,
      order_id: `QUOTE-${quote.quote_number}`,
      channel: 'other',
      sale_date: new Date().toISOString().split('T')[0],
      product_name: quote.project_name,
      quantity: 1,
      gross_total: quote.total,
      shipping_charged: 0,
      net_payout: quote.total,
      status: 'pending',
      notes: `Converted from quote ${quote.quote_number}`
    });

    // Update quote with order reference
    const updatedQuote = await base44.entities.Quote.update(quoteId, {
      status: 'Paid',
      converted_to_order_id: order.id
    });

    return Response.json({ quote: updatedQuote, order });
  } catch (error) {
    console.error('Conversion error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});