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

    // Validate status against allowed enum
    if (status !== 'provisional' && status !== 'final') {
      return Response.json({ error: 'Invalid status — must be provisional or final' }, { status: 400 });
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return Response.json({ error: 'Invalid month format — must be YYYY-MM' }, { status: 400 });
    }

    // Validate period dates are parseable
    if (isNaN(Date.parse(period_start)) || isNaN(Date.parse(period_end))) {
      return Response.json({ error: 'Invalid period dates' }, { status: 400 });
    }

    // Sanitize checklist — only allow known boolean fields, ignore fabricated keys
    const allowedChecklistKeys = ['reconciliation_checked', 'unmatched_reviewed', 'refunds_verified', 'deposits_verified'];
    const sanitizedChecklist = {};
    if (checklist && typeof checklist === 'object' && !Array.isArray(checklist)) {
      for (const key of allowedChecklistKeys) {
        sanitizedChecklist[key] = !!checklist[key];
      }
    }

    // Prevent re-closing an already-finalized month
    const existingClosures = await base44.entities.MonthClosed.filter({
      owner_user_id: user.id,
      month
    });
    if (existingClosures.some(c => c.status === 'final')) {
      return Response.json({ error: 'Month is already finalized and cannot be re-closed' }, { status: 409 });
    }

    // Create month closure record
    const monthClosed = await base44.entities.MonthClosed.create({
      owner_user_id: user.id,
      month,
      period_start,
      period_end,
      status,
      checklist: sanitizedChecklist,
      notes: typeof notes === 'string' ? notes : '',
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