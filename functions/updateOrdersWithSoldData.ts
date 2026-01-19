import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orders } = await req.json();

    if (!Array.isArray(orders)) {
      return Response.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const result = { updated: 0, skipped: 0, failed: 0 };

    for (const order of orders) {
      if (!order.order_id) {
        result.skipped++;
        continue;
      }

      const existing = await base44.entities.EtsyOrder.filter({ 
        order_id: order.order_id 
      });

      if (existing.length > 0) {
        const updateData = {};
        if (order.sku) updateData.sku = order.sku;
        if (order.product_name) updateData.product_name = order.product_name;
        if (order.coupon_code) updateData.coupon_code = order.coupon_code;
        if (order.buyer_username) updateData.buyer_username = order.buyer_username;
        if (order.buyer_full_name) updateData.buyer_full_name = order.buyer_full_name;
        if (order.number_of_items) updateData.number_of_items = order.number_of_items;
        if (order.order_value) updateData.order_value = order.order_value;
        if (order.shipping_charged !== undefined && order.shipping_charged !== null) updateData.shipping_charged = order.shipping_charged;
        if (order.sales_tax !== undefined && order.sales_tax !== null) updateData.sales_tax = order.sales_tax;
        if (order.order_total) updateData.order_total = order.order_total;
        if (order.order_net) updateData.order_net = order.order_net;
        if (order.discount_amount !== undefined && order.discount_amount !== null) updateData.discount_amount = order.discount_amount;
        if (order.card_processing_fees !== undefined && order.card_processing_fees !== null) updateData.card_processing_fees = order.card_processing_fees;
        
        if (Object.keys(updateData).length > 0) {
          await base44.entities.EtsyOrder.update(existing[0].id, updateData);
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        result.skipped++;
      }

      if ((result.updated + result.skipped) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});