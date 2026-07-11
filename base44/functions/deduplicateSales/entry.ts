import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Use asServiceRole to bypass RLS visibility issues (records may have system created_by_id)
    // but filter by owner_user_id to only touch this user's data
    const [customSales, etsyOrders] = await Promise.all([
      base44.asServiceRole.entities.CustomSale.filter({ owner_user_id: user.id }, '-date', 1000),
      base44.asServiceRole.entities.EtsyOrder.filter({ owner_user_id: user.id }, '-created_date', 1000),
    ]);

    const dateShift = (dateStr, deltaDays) => {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + deltaDays);
      return d.toISOString().split('T')[0];
    };

    // 1. Find duplicate EtsyOrders (same order_id, keep oldest = lowest created_date)
    const orderIdMap = {};
    etsyOrders.forEach((o) => {
      const oid = String(o.order_id || '').trim();
      if (!oid) return;
      if (!orderIdMap[oid]) orderIdMap[oid] = [];
      orderIdMap[oid].push(o);
    });

    const etsyOrderDuplicates = [];
    Object.entries(orderIdMap).forEach(([oid, orders]) => {
      if (orders.length <= 1) return;
      // Sort by created_date ascending — keep first (oldest), delete rest
      const sorted = orders.sort((a, b) =>
        new Date(a.created_date || 0) - new Date(b.created_date || 0)
      );
      for (let i = 1; i < sorted.length; i++) {
        etsyOrderDuplicates.push({
          id: sorted[i].id,
          order_id: oid,
          sale_date: sorted[i].sale_date,
          order_total: sorted[i].order_total,
          duplicate_type: 'etsy_order_duplicate',
          keeps_id: sorted[0].id,
        });
      }
    });

    // 1b. Find "fuzzy" EtsyOrder duplicates — same date + same buyer + same amount,
    // but different order_ids (e.g. Etsy created two order records for one Square charge).
    // Flag them with possible_duplicate=true rather than auto-deleting, since two real
    // orders CAN legitimately share these fields — requires human review.
    const etsyFuzzyMap = {};
    etsyOrders.forEach((o) => {
      if (!o.sale_date || !o.buyer_username || !o.order_value) return;
      const oid = String(o.order_id || '').trim();
      const key = `${o.sale_date}|${o.buyer_username}|${Number(o.order_value).toFixed(2)}`;
      if (!etsyFuzzyMap[key]) etsyFuzzyMap[key] = [];
      etsyFuzzyMap[key].push({ id: o.id, order_id: oid });
    });

    const fuzzyDupeIds = new Set();
    const fuzzyDuplicateGroups = [];
    Object.entries(etsyFuzzyMap).forEach(([key, orders]) => {
      // Only flag if there are 2+ orders with DIFFERENT order_ids
      const uniqueOrderIds = new Set(orders.map((o) => o.order_id));
      if (orders.length <= 1 || uniqueOrderIds.size <= 1) return;
      orders.forEach((o) => fuzzyDupeIds.add(o.id));
      fuzzyDuplicateGroups.push({
        key,
        order_ids: orders.map((o) => o.order_id),
        ids: orders.map((o) => o.id),
        order_value: Number(orders[0] ? 0 : 0),
        count: orders.length,
      });
    });

    // Update possible_duplicate flag on all EtsyOrders
    const flagUpdates = [];
    for (const o of etsyOrders) {
      const shouldFlag = fuzzyDupeIds.has(o.id);
      if (!!o.possible_duplicate !== shouldFlag) {
        flagUpdates.push(
          base44.asServiceRole.entities.EtsyOrder.update(o.id, { possible_duplicate: shouldFlag })
        );
      }
    }
    if (flagUpdates.length > 0) await Promise.all(flagUpdates);

    // 2. Find CustomSales that near-match EtsyOrders (same date ± 1 day, amount within $5)
    // This catches Square in-person sales where Square's "Total Collected" differs from
    // Etsy's "Order Total" by a few dollars (e.g. $3 Square processing fee)
    const etsyForMatching = etsyOrders.map((o) => ({
      id: o.id,
      sale_date: o.sale_date,
      amounts: [o.order_total, o.adjusted_order_total, o.order_value, o.order_net, o.adjusted_net_order_amount]
        .filter((a) => a != null && !isNaN(a)),
    }));

    const crossEntityDuplicates = [];
    customSales.forEach((s) => {
      if (!s.date || !s.gross_sale) return;
      for (let delta = -1; delta <= 1; delta++) {
        const sDate = dateShift(s.date, delta);
        for (const o of etsyForMatching) {
          if (!o.sale_date) continue;
          const oDate = dateShift(o.sale_date, delta);
          if (oDate !== sDate) continue;
          for (const oAmt of o.amounts) {
            if (Math.abs(oAmt - s.gross_sale) <= 5) {
              crossEntityDuplicates.push({
                id: s.id,
                date: s.date,
                gross_sale: s.gross_sale,
                vendor: s.vendor,
                description: s.description,
                payment_source: s.payment_source,
                duplicate_type: 'matches_etsy_order',
                matched_etsy_order_id: o.id,
                matched_order_total: oAmt,
                amount_diff: s.gross_sale - oAmt,
              });
              return; // Don't add the same CustomSale twice
            }
          }
        }
      }
    });

    // 3. Find CustomSale-to-CustomSale duplicates (same date + amount, keep oldest)
    const csDateAmountMap = {};
    customSales.forEach((s) => {
      if (!s.date || !s.gross_sale) return;
      const key = `${s.date}|${Number(s.gross_sale).toFixed(2)}`;
      if (!csDateAmountMap[key]) csDateAmountMap[key] = [];
      csDateAmountMap[key].push(s);
    });

    const customSaleInternalDupes = [];
    Object.entries(csDateAmountMap).forEach(([key, sales]) => {
      if (sales.length <= 1) return;
      const sorted = sales.sort((a, b) =>
        new Date(a.created_date || 0) - new Date(b.created_date || 0)
      );
      for (let i = 1; i < sorted.length; i++) {
        customSaleInternalDupes.push({
          id: sorted[i].id,
          date: sorted[i].date,
          gross_sale: sorted[i].gross_sale,
          vendor: sorted[i].vendor,
          description: sorted[i].description,
          duplicate_type: 'custom_sale_duplicate',
          keeps_id: sorted[0].id,
        });
      }
    });

    const allDuplicates = [...etsyOrderDuplicates, ...crossEntityDuplicates, ...customSaleInternalDupes];

    const dryRun = req.method === 'GET';

    if (dryRun) {
      return Response.json({
        duplicate_count: allDuplicates.length,
        etsy_order_duplicates: etsyOrderDuplicates.length,
        fuzzy_etsy_duplicates_flagged: fuzzyDuplicateGroups.length,
        cross_entity_duplicates: crossEntityDuplicates.length,
        custom_sale_internal_duplicates: customSaleInternalDupes.length,
        duplicates: allDuplicates,
        fuzzy_duplicate_groups: fuzzyDuplicateGroups,
        flagged_orders_updated: flagUpdates.length,
      });
    }

    // Delete duplicates — EtsyOrders and CustomSales from different entities
    const etsyIdsToDelete = etsyOrderDuplicates.map((d) => d.id);
    const customSaleIdsToDelete = [...crossEntityDuplicates, ...customSaleInternalDupes].map((d) => d.id);

    // Delete EtsyOrder duplicates
    for (const id of etsyIdsToDelete) {
      await base44.asServiceRole.entities.EtsyOrder.delete(id);
    }

    // Delete CustomSale duplicates
    for (const id of customSaleIdsToDelete) {
      await base44.asServiceRole.entities.CustomSale.delete(id);
    }

    return Response.json({
      deleted: allDuplicates.length,
      etsy_order_duplicates_removed: etsyOrderDuplicates.length,
      cross_entity_duplicates_removed: crossEntityDuplicates.length,
      custom_sale_duplicates_removed: customSaleInternalDupes.length,
      etsy_deleted_ids: etsyIdsToDelete,
      custom_sale_deleted_ids: customSaleIdsToDelete,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});