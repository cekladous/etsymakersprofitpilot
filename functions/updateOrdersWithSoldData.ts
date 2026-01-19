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

    const result = { updated: 0, skipped: 0, failed: 0, customers_created: 0, customers_updated: 0 };

    for (const order of orders) {
      if (!order.order_id) {
        result.skipped++;
        continue;
      }

      // Create or update customer if buyer info exists
      if (order.customer?.name) {
        const existingCustomers = await base44.entities.Customer.filter({ 
          name: order.customer.name 
        });
        
        if (existingCustomers.length > 0) {
          await base44.entities.Customer.update(existingCustomers[0].id, order.customer);
          result.customers_updated++;
        } else {
          await base44.entities.Customer.create(order.customer);
          result.customers_created++;
        }
      }

      const existing = await base44.entities.EtsyOrder.filter({ 
        order_id: String(order.order_id).trim()
      });

      if (existing.length > 0) {
        const updateData = {};
        // Update all provided fields
        if (order.sku) updateData.sku = order.sku;
        if (order.product_name) updateData.product_name = order.product_name;
        if (order.coupon_code) updateData.coupon_code = order.coupon_code;
        if (order.buyer_username) updateData.buyer_username = order.buyer_username;
        if (order.buyer_full_name) updateData.buyer_full_name = order.buyer_full_name;
        if (order.number_of_items) updateData.number_of_items = order.number_of_items;
        if (order.order_value) updateData.order_value = order.order_value;
        updateData.shipping_charged = order.shipping_charged;
        updateData.sales_tax = order.sales_tax;
        updateData.discount_amount = order.discount_amount;
        updateData.shipping_discount = order.shipping_discount;
        updateData.card_processing_fees = order.card_processing_fees;
        updateData.adjusted_card_processing_fees = order.adjusted_card_processing_fees;
        if (order.order_total) updateData.order_total = order.order_total;
        if (order.adjusted_order_total) updateData.adjusted_order_total = order.adjusted_order_total;
        if (order.order_net) updateData.order_net = order.order_net;
        if (order.adjusted_net_order_amount) updateData.adjusted_net_order_amount = order.adjusted_net_order_amount;
        if (order.payment_method) updateData.payment_method = order.payment_method;
        if (order.date_shipped) updateData.date_shipped = order.date_shipped;
        if (order.currency) updateData.currency = order.currency;
        if (order.order_type) updateData.order_type = order.order_type;
        if (order.payment_type) updateData.payment_type = order.payment_type;
        if (order.inperson_discount) updateData.inperson_discount = order.inperson_discount;
        if (order.inperson_location) updateData.inperson_location = order.inperson_location;
        if (order.status) updateData.status = order.status;
        
        await base44.entities.EtsyOrder.update(existing[0].id, updateData);
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