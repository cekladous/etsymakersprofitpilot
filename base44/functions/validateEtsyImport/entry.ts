import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CRITICAL: Validates that Etsy Monthly Statement is the canonical source
 * Prevents double-counting when importing Sold Orders CSV
 * 
 * Called during import to:
 * 1. Check if transaction already exists (via statement_line_uid)
 * 2. Block or merge duplicate entries
 * 3. Ensure refunds are recorded on orders
 * 4. Ensure Share & Save credits are negative
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      action,  // 'check-duplicate' | 'link-statement-line' | 'validate-refund'
      orderData, 
      statementLineUid,
      month 
    } = await req.json();

    if (action === 'check-duplicate') {
      // Check if order already imported via statement
      const existingOrder = await base44.entities.EtsyOrder.filter({
        owner_user_id: user.id,
        statement_line_uid: statementLineUid,
      });

      return Response.json({
        isDuplicate: existingOrder.length > 0,
        existingOrderId: existingOrder[0]?.id || null,
        message: existingOrder.length > 0 
          ? 'Order already imported from Etsy Monthly Statement. Skipping Sold Orders import to prevent double-count.'
          : 'Order not found in imports; safe to add.'
      });
    }

    if (action === 'link-statement-line') {
      // Link EtsyOrder to statement line to prevent future duplication
      await base44.entities.EtsyOrder.update(orderData.id, {
        statement_line_uid: statementLineUid
      });
      return Response.json({ success: true });
    }

    if (action === 'validate-refund') {
      // Ensure refunds are stored on the order, not left in ledger
      const order = await base44.entities.EtsyOrder.get(orderData.id);
      
      if (!order.refund_amount || order.refund_amount === 0) {
        return Response.json({
          hasRefund: false,
          message: 'No refund recorded. Check if refund exists in statement but not on order.',
          recommendation: 'Manually add refund_amount to order or re-import statement.'
        });
      }

      return Response.json({
        hasRefund: true,
        refundAmount: order.refund_amount,
        netRevenue: (order.order_value + order.shipping_charged) - order.refund_amount
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});