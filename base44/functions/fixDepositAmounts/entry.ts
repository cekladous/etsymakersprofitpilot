import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const parseMoney = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const str = String(v ?? "").trim();
  const isNegative = str.includes("(") && str.includes(")");
  const cleaned = str.replace(/[$(),\s]/g, "");
  const num = parseFloat(cleaned);
  return (isNaN(num) ? 0 : num) * (isNegative ? -1 : 1);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Re-verify admin role from the database — don't trust the role
    // from the auth token, which could be stale or tampered with.
    const userRecords = await base44.asServiceRole.entities.User.filter({ id: user.id });
    if (!userRecords[0] || userRecords[0].role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all deposits with zero or near-zero amounts
    const allDeposits = await base44.entities.Transfer.list();
    const depositsToFix = allDeposits.filter(d => 
      d.type === "etsy_deposit" && (!d.amount || d.amount === 0)
    );

    let fixed = 0;
    let skipped = 0;

    for (const deposit of depositsToFix) {
      const notes = deposit.notes || "";
      const amountMatch = notes.match(/\$[\d,]+\.?\d*/);
      
      if (amountMatch) {
        const extractedAmount = parseMoney(amountMatch[0]);
        if (extractedAmount > 0) {
          await base44.entities.Transfer.update(deposit.id, {
            amount: extractedAmount
          });
          fixed++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    return Response.json({
      success: true,
      message: `Fixed ${fixed} deposits, skipped ${skipped} (no amount found in description)`,
      fixed,
      skipped,
      total: depositsToFix.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});