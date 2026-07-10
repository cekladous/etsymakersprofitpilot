import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find all CustomSale records for this user where created_by_id doesn't match
    const allSales = await base44.asServiceRole.entities.CustomSale.filter({
      owner_user_id: user.id
    });

    const broken = allSales.filter(s => s.created_by_id && s.created_by_id !== user.id);

    if (broken.length === 0) {
      return Response.json({ message: 'No broken records found', fixed: 0 });
    }

    // Save the data, delete old records, recreate with user-scoped SDK
    const savedData = broken.map(s => ({
      date: s.date,
      vendor: s.vendor,
      description: s.description,
      payment_source: s.payment_source,
      pre_tax_amount: s.pre_tax_amount,
      sales_tax_collected: s.sales_tax_collected,
      gross_sale: s.gross_sale,
      shipping_or_postage_cost: s.shipping_or_postage_cost,
      notes: s.notes,
      owner_user_id: user.id
    }));

    // Delete old records
    for (const s of broken) {
      await base44.asServiceRole.entities.CustomSale.delete(s.id);
    }

    // Recreate using user-scoped SDK (sets created_by_id to the user's ID)
    const recreated = await base44.entities.CustomSale.bulkCreate(savedData);

    return Response.json({
      message: 'Fixed CustomSale ownership',
      deleted: broken.length,
      recreated: recreated.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});