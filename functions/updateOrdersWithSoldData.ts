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
          ...existing[0],
          sku: order.sku || existing[0].sku,
          product_name: order.product_name || existing[0].product_name,
          coupon_code: order.coupon_code || existing[0].coupon_code,
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