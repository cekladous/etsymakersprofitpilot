import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();

    if (!code) {
      return Response.json({ error: 'Code required' }, { status: 400 });
    }

    // Find and update the promo code
    const promoCodes = await base44.asServiceRole.entities.PromoCode.filter({
      code: code.toUpperCase()
    });

    if (promoCodes.length === 0) {
      return Response.json({ error: 'Promo code not found' }, { status: 404 });
    }

    const promo = promoCodes[0];

    // Validate promo is still usable before incrementing (prevents brute-force exhaustion)
    if (!promo.is_active) {
      return Response.json({ error: 'Promo code is no longer active' }, { status: 410 });
    }
    if (promo.expires_at) {
      const expiry = new Date(promo.expires_at + 'T23:59:59');
      if (expiry < new Date()) {
        return Response.json({ error: 'Promo code has expired' }, { status: 410 });
      }
    }
    if (promo.max_uses !== -1 && (promo.current_uses || 0) >= promo.max_uses) {
      return Response.json({ error: 'Promo code usage limit reached' }, { status: 410 });
    }

    const newUses = (promo.current_uses || 0) + 1;

    await base44.asServiceRole.entities.PromoCode.update(promo.id, {
      current_uses: newUses
    });

    return Response.json({ success: true, current_uses: newUses });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});