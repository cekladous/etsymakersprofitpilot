import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Close a month: create audit trail + optional lock
 * Prevents edits to locked months
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { month, period_start, period_end, status, checklist, notes } = await req.json();

    // Validate required fields
    if (!month || !period_start || !period_end || !status) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create month closure record
    const monthClosed = await base44.entities.MonthClosed.create({
      owner_user_id: user.id,
      month,
      period_start,
      period_end,
      status,
      checklist,
      notes,
      closed_at: new Date().toISOString(),
      closed_by: user.email,
    });

    return Response.json({
      success: true,
      monthClosed,
      message: `Month ${month} closed as ${status}. ${status === 'final' ? 'No further edits allowed.' : 'Provisional - edits still allowed.'}`,
    });
  } catch (error) {
    console.error('Close month error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});