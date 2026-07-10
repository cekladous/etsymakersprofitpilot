import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Re-verify admin role from the database — don't trust the role
    // from the auth token, which could be stale or tampered with.
    const userRecords = await base44.asServiceRole.entities.User.filter({ id: user.id });
    if (!userRecords[0] || userRecords[0].role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all December 2025 orders
    const decemberOrders = await base44.entities.EtsyOrder.filter({});
    const decemberFiltered = decemberOrders.filter(o => 
      o.sale_date && o.sale_date.startsWith('2025-12')
    );

    console.log(`Found ${decemberFiltered.length} December orders`);

    // Get all order fees
    const allOrderFees = await base44.entities.OrderFee.list();
    const feeMap = {};
    allOrderFees.forEach(f => {
      feeMap[f.order_id] = f;
    });

    // Update each December order with corrected net payout
    let updated = 0;
    for (const order of decemberFiltered) {
      const fees = feeMap[order.order_id];
      const totalFees = fees ? fees.total_fees : 0;
      const correctNetPayout = order.order_value - totalFees;

      // Only update if it's different
      if (order.order_net !== correctNetPayout) {
        await base44.entities.EtsyOrder.update(order.id, {
          order_net: correctNetPayout
        });
        updated++;
        console.log(`Updated order #${order.order_id}: ${order.order_net} → ${correctNetPayout}`);
      }
    }

    return Response.json({ 
      success: true,
      total: decemberFiltered.length,
      updated: updated,
      message: `Fixed ${updated} orders in December 2025`
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});