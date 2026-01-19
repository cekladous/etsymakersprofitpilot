import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all orders with order_value = 0 from December 2025
    const orders = await base44.entities.EtsyOrder.filter({});
    const decemberOrders = orders.filter(o => 
      o.sale_date && o.sale_date.startsWith('2025-12') && o.order_value === 0
    );

    console.log(`Found ${decemberOrders.length} December orders with order_value = 0`);

    // Get all order fees
    const allOrderFees = await base44.entities.OrderFee.list();

    let updated = 0;
    for (const order of decemberOrders) {
      // Find fees for this order
      const orderFees = allOrderFees.find(f => f.order_id === order.order_id);
      const totalFees = orderFees?.total_fees || 0;

      // Calculate: order_value = order_total - shipping - fees
      const derivedOrderValue = Math.max(
        0,
        (order.order_total || 0) - (order.shipping_charged || 0) - totalFees
      );

      if (derivedOrderValue > 0) {
        await base44.entities.EtsyOrder.update(order.id, {
          order_value: derivedOrderValue
        });
        updated++;
        console.log(`Updated order ${order.order_id}: order_value = ${derivedOrderValue}`);
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