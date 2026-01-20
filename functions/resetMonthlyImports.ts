import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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