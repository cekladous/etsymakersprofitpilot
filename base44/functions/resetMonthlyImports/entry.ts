import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    // Get all Free tier subscriptions
    const freeSubscriptions = await base44.asServiceRole.entities.Subscription.filter({
      plan_id: 'free'
    });

    let updated = 0;
    for (const subscription of freeSubscriptions) {
      await base44.asServiceRole.entities.Subscription.update(subscription.id, {
        imports_used_this_month: 0
      });
      updated++;
    }

    return Response.json({
      success: true,
      message: `Reset imports for ${updated} Free tier subscriptions`,
      updated
    });
  } catch (error) {
    console.error('Reset monthly imports error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});