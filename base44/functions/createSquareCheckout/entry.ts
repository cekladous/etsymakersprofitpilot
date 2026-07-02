import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SQUARE_PLAN_IDS = {
  maker_pro: 'maker_pro_plan',
  maker_plus: 'maker_plus_plan'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = await req.json();

    if (!planId || !SQUARE_PLAN_IDS[planId]) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Redirect to checkout page
    return Response.json({
      checkoutUrl: `checkout?plan=${planId}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});