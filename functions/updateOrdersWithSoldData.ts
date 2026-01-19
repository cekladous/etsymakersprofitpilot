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
        await base44.entities.EtsyOrder.update(existing[0].id, {
          sku: order.sku !== undefined ? order.sku : existing[0].sku,
          product_name: order.product_name !== undefined ? order.product_name : existing[0].product_name,
          coupon_code: order.coupon_code !== undefined ? order.coupon_code : existing[0].coupon_code,
          buyer_username: order.buyer_username !== undefined ? order.buyer_username : existing[0].buyer_username,
          buyer_full_name: order.buyer_full_name !== undefined ? order.buyer_full_name : existing[0].buyer_full_name,
          number_of_items: order.number_of_items !== undefined && order.number_of_items !== 0 ? order.number_of_items : existing[0].number_of_items,
          order_value: order.order_value !== undefined && order.order_value !== 0 ? order.order_value : existing[0].order_value,
          shipping_charged: order.shipping_charged !== undefined && order.shipping_charged !== 0 ? order.shipping_charged : existing[0].shipping_charged,
          sales_tax: order.sales_tax !== undefined && order.sales_tax !== 0 ? order.sales_tax : existing[0].sales_tax,
          order_total: order.order_total !== undefined && order.order_total !== 0 ? order.order_total : existing[0].order_total,
          order_net: order.order_net !== undefined && order.order_net !== 0 ? order.order_net : existing[0].order_net,
          discount_amount: order.discount_amount !== undefined && order.discount_amount !== 0 ? order.discount_amount : existing[0].discount_amount,
          card_processing_fees: order.card_processing_fees !== undefined && order.card_processing_fees !== 0 ? order.card_processing_fees : existing[0].card_processing_fees,
        });
        result.updated++;
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