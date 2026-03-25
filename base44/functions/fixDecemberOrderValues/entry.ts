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

      // Calculate order_value and shipping
      // From Sold Orders: order_total - shipping - taxes ≈ order_value
      // So: shipping = order_total - order_value - taxes
      
      let shippingCharged = order.shipping_charged || 0;
      let orderValue = order.order_value || 0;

      // If we don't have shipping, estimate it: order_total - taxes - order_value (roughly)
      if (shippingCharged === 0 && order.order_total) {
        shippingCharged = Math.max(0, (order.order_total || 0) - (order.sales_tax || 0));
      }

      // If we don't have order_value, derive from: order_total - shipping - taxes
      if (orderValue === 0 && order.order_total) {
        orderValue = Math.max(0, (order.order_total || 0) - shippingCharged - (order.sales_tax || 0));
      }

      if (orderValue > 0 || shippingCharged > 0) {
        await base44.entities.EtsyOrder.update(order.id, {
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