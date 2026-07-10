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

    console.log(`[AUDIT] fixDecemberOrderValues invoked by user ${user.id} (${user.email || 'no email'})`);

    // Scope to the calling admin's own records — never modify other users' data
    const orders = await base44.asServiceRole.entities.EtsyOrder.filter({ owner_user_id: user.id });
    const decemberOrders = orders.filter(o => 
      o.sale_date && o.sale_date.startsWith('2025-12') && o.order_value === 0
    );

    console.log(`Found ${decemberOrders.length} December orders with order_value = 0`);

    // Get order fees scoped to this admin
    const allOrderFees = await base44.asServiceRole.entities.OrderFee.filter({ owner_user_id: user.id });

    let updated = 0;
    for (const order of decemberOrders) {
      // Find fees for this order
      const orderFees = allOrderFees.find(f => f.order_id === order.order_id);
      const totalFees = orderFees?.total_fees || 0;

      // Calculate order_value and shipping
      let shippingCharged = order.shipping_charged || 0;
      let orderValue = order.order_value || 0;

      if (shippingCharged === 0 && order.order_total) {
        shippingCharged = Math.max(0, (order.order_total || 0) - (order.sales_tax || 0));
      }

      if (orderValue === 0 && order.order_total) {
        orderValue = Math.max(0, (order.order_total || 0) - shippingCharged - (order.sales_tax || 0));
      }

      if (orderValue > 0 || shippingCharged > 0) {
        await base44.asServiceRole.entities.EtsyOrder.update(order.id, {
          order_value: orderValue,
          shipping_charged: shippingCharged
        });
        updated++;
        console.log(`Updated order ${order.order_id}: order_value = ${orderValue}, shipping = ${shippingCharged}`);
      }
    }

    return Response.json({
      success: true,
      message: `Fixed ${updated} orders`,
      totalFound: decemberOrders.length,
      updated
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});