import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    const result = { created: 0, updated: 0, skipped: 0, failed: 0, customers_created: 0, customers_updated: 0 };

    // Pre-fetch all existing orders and customers ONCE to avoid N+1 queries
    const allExistingOrders = await base44.entities.EtsyOrder.filter({ owner_user_id: user.id });
    const orderMap = {};
    allExistingOrders.forEach(o => { orderMap[String(o.order_id).trim()] = o; });

    const allExistingCustomers = await base44.entities.Customer.filter({ owner_user_id: user.id });
    const customerByBuyerName = {};
    const customerByName = {};
    allExistingCustomers.forEach(c => {
      if (c.etsy_buyer_name) customerByBuyerName[c.etsy_buyer_name] = c;
      if (c.name) customerByName[c.name.toLowerCase()] = c;
    });

    for (const order of orders) {
      if (!order.order_id) {
        result.skipped++;
        continue;
      }

      const orderIdKey = String(order.order_id).trim();

      // Create or update customer — deduplicate by etsy_buyer_name first, then by name
      if (order.customer?.name || order.customer?.etsy_buyer_name) {
        try {
          let match = null;
          if (order.customer.etsy_buyer_name) match = customerByBuyerName[order.customer.etsy_buyer_name];
          if (!match && order.customer.name) match = customerByName[order.customer.name.toLowerCase()];

          if (match) {
            const updateData = {};
            if (order.customer.name && order.customer.name !== match.name) updateData.name = order.customer.name;
            if (order.customer.etsy_buyer_name && !match.etsy_buyer_name) updateData.etsy_buyer_name = order.customer.etsy_buyer_name;
            if (order.customer.address && !match.address) updateData.address = order.customer.address;
            if (Object.keys(updateData).length > 0) {
              await base44.entities.Customer.update(match.id, updateData);
            }
            result.customers_updated++;
          } else {
            const newCustomer = await base44.entities.Customer.create({ ...order.customer, owner_user_id: user.id });
            if (order.customer.etsy_buyer_name) customerByBuyerName[order.customer.etsy_buyer_name] = newCustomer;
            if (order.customer.name) customerByName[order.customer.name.toLowerCase()] = newCustomer;
            result.customers_created++;
          }
        } catch (err) {
          console.log("Customer error:", err.message);
        }
      }

      const existing = orderMap[orderIdKey];

      if (existing) {
        const updateData = {};
        if (order.sku) updateData.sku = order.sku;
        if (order.product_name) updateData.product_name = order.product_name;
        if (order.coupon_code) updateData.coupon_code = order.coupon_code;
        if (order.buyer_username) updateData.buyer_username = order.buyer_username;
        if (order.buyer_full_name) updateData.buyer_full_name = order.buyer_full_name;
        if (order.first_name) updateData.first_name = order.first_name;
        if (order.last_name) updateData.last_name = order.last_name;
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
        
        await base44.entities.EtsyOrder.update(existing.id, updateData);
        result.updated++;
      } else {
        // Create new order from Sold Orders Report data
        const { customer, ...orderData } = order;
        const newOrder = await base44.entities.EtsyOrder.create({
          ...orderData,
          owner_user_id: user.id,
          source: 'etsy_sold_orders'
        });
        orderMap[orderIdKey] = newOrder;
        result.created++;
      }

      if ((result.created + result.updated + result.skipped) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});