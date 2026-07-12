import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch ALL CustomSale records using service role (bypasses RLS)
    const allSales = await base44.asServiceRole.entities.CustomSale.list('-created_date', 5000);

    // Helper: get owner_user_id from either flattened or nested data structure
    const getOwnerId = (s) => s.owner_user_id || (s.data && s.data.owner_user_id);

    // Find records that belong to this user via owner_user_id
    const userSales = allSales.filter(s => getOwnerId(s) === user.id);

    if (userSales.length === 0) {
      return Response.json({
        message: 'No CustomSale records found for your account. If you expect sales here, they may need to be re-created from the original source (e.g., re-sync from Square or re-mark invoices as Paid).',
        found: 0,
        totalInDb: allSales.length,
        fixed: 0
      });
    }

    // For every record that belongs to this user, delete and recreate
    // using the user-scoped SDK so created_by_id is set correctly.
    const extractField = (s, field) => s[field] || (s.data && s.data[field]);

    const savedData = userSales.map(s => ({
      date: extractField(s, 'date'),
      vendor: extractField(s, 'vendor'),
      description: extractField(s, 'description'),
      payment_source: extractField(s, 'payment_source'),
      pre_tax_amount: extractField(s, 'pre_tax_amount'),
      sales_tax_collected: extractField(s, 'sales_tax_collected'),
      gross_sale: extractField(s, 'gross_sale'),
      shipping_or_postage_cost: extractField(s, 'shipping_or_postage_cost'),
      notes: extractField(s, 'notes'),
      owner_user_id: user.id
    }));

    // Delete old records via service role
    for (const s of userSales) {
      await base44.asServiceRole.entities.CustomSale.delete(s.id);
    }

    // Recreate using user-scoped SDK (sets system created_by_id to the user's ID)
    const recreated = await base44.entities.CustomSale.bulkCreate(savedData);

    return Response.json({
      message: `Fixed! ${recreated.length} CustomSale record(s) recreated under your account.`,
      found: userSales.length,
      deleted: userSales.length,
      recreated: recreated.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});