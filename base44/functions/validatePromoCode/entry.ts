import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, planId } = await req.json();

    if (!code || !planId) {
      return Response.json({ error: 'Code and planId required' }, { status: 400 });
    }

    // Find the promo code
    const promoCodes = await base44.asServiceRole.entities.PromoCode.filter({
      code: code.toUpperCase(),
      is_active: true
    });

    if (promoCodes.length === 0) {
      return Response.json({ valid: false, error: 'Invalid promo code' }, { status: 200 });
    }

    const promo = promoCodes[0];

    // Check expiration
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return Response.json({ valid: false, error: 'Promo code has expired' }, { status: 200 });
    }

    // Check usage limit
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return Response.json({ valid: false, error: 'Promo code usage limit reached' }, { status: 200 });
    }

    // Check if plan matches
    if (promo.plan_id !== planId) {
      return Response.json({ 
        valid: false, 
        error: `Promo code is for ${promo.plan_id}, not ${planId}` 
      }, { status: 200 });
    }

    return Response.json({
      valid: true,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      duration_months: promo.duration_months,
      plan_id: promo.plan_id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});