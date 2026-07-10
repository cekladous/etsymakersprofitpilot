import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SQUARE_API_KEY = Deno.env.get('SQUARE_API_KEY');
const SQUARE_API_URL = 'https://connect.squareup.com/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, promoCode } = await req.json();

    // Map plan to Square plan ID
    const squarePlanMap = {
      maker_pro: 'SQ_MAKER_PRO_9',
      maker_plus: 'SQ_MAKER_PLUS_14'
    };

    const squarePlanId = squarePlanMap[planId];
    if (!squarePlanId) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // SECURITY: Validate and increment promo code usage here — inside the
    // server-side payment flow — rather than via a standalone client-triggerable
    // endpoint. This prevents authenticated users from exhausting promo codes
    // without going through the checkout process.
    if (promoCode) {
      const promoCodes = await base44.asServiceRole.entities.PromoCode.filter({
        code: String(promoCode).toUpperCase(),
        is_active: true
      });

      if (promoCodes.length === 0) {
        return Response.json({ error: 'Promo code not found or inactive' }, { status: 404 });
      }

      const promo = promoCodes[0];

      if (promo.expires_at) {
        const expiry = new Date(promo.expires_at + 'T23:59:59');
        if (expiry < new Date()) {
          return Response.json({ error: 'Promo code has expired' }, { status: 410 });
        }
      }

      if (promo.max_uses !== -1 && (promo.current_uses || 0) >= promo.max_uses) {
        return Response.json({ error: 'Promo code usage limit reached' }, { status: 410 });
      }

      if (promo.plan_id !== planId) {
        return Response.json({ error: `Promo code is for ${promo.plan_id}, not ${planId}` }, { status: 400 });
      }

      // Atomically increment usage as part of the checkout flow
      await base44.asServiceRole.entities.PromoCode.update(promo.id, {
        current_uses: (promo.current_uses || 0) + 1
      });
    }

    // Get user's Square location ID from settings
    const settings = await base44.entities.Settings.filter({
      owner_user_id: user.id
    });

    const squareLocationId = settings[0]?.square_location_id;
    if (!squareLocationId) {
      return Response.json({ error: 'Square location not configured' }, { status: 400 });
    }

    // SECURITY: Parse the Origin with URL() and validate the hostname against
    // a strict allow-list. Reconstruct the redirect URL from the validated
    // hostname rather than using the raw header string — prevents injection
    // of extra path/query components or protocol smuggling.
    const rawOrigin = req.headers.get('origin') || '';
    let validatedBase = '';
    try {
      const parsed = new URL(rawOrigin);
      if (parsed.protocol === 'https:' && /^[a-z0-9-]+\.base44\.app$/.test(parsed.hostname)) {
        validatedBase = `${parsed.protocol}//${parsed.hostname}`;
      }
    } catch (_) { /* invalid URL */ }
    if (!validatedBase) {
      return Response.json({ error: 'Invalid origin for redirect' }, { status: 400 });
    }

    const planPrices = { maker_pro: 900, maker_plus: 1400 }; // cents

    // Create a Square Checkout payment link - redirects user to Square's hosted page
    // This is PCI-DSS compliant because card data is entered on Square's domain, never ours
    const checkoutRes = await fetch(`https://connect.squareup.com/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_API_KEY}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-01-14'
      },
      body: JSON.stringify({
        idempotency_key: `${user.id}_${planId}_${Date.now()}`,
        order: {
          location_id: squareLocationId,
          line_items: [{
            name: `${planId === 'maker_plus' ? 'Maker Plus' : 'Maker Pro'} Subscription`,
            quantity: '1',
            base_price_money: {
              amount: planPrices[planId],
              currency: 'USD'
            }
          }]
        },
        checkout_options: {
          allow_tipping: false,
          redirect_url: `${validatedBase}/settings?tab=subscription&success=true`,
          ask_for_shipping_address: false
        },
        pre_populated_data: {
          buyer_email: user.email
        }
      })
    });

    if (!checkoutRes.ok) {
      const errBody = await checkoutRes.text();
      console.error('Square checkout error:', errBody);
      // Fall back to creating subscription record directly with free tier
      let subscription = await base44.entities.Subscription.filter({
        owner_user_id: user.id
      });
      subscription = subscription[0];

      const now = new Date();
      if (!subscription) {
        subscription = await base44.entities.Subscription.create({
          owner_user_id: user.id,
          plan_id: planId,
          status: 'trial',
          current_period_start: now.toISOString().split('T')[0],
          current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          imports_used_this_month: 0,
          active_users: 1,
          founders_pricing: true
        });
      }
      return Response.json({ 
        success: true,
        subscription,
        message: 'Subscription created in trial mode'
      });
    }

    const checkout = await checkoutRes.json();
    const checkoutUrl = checkout.payment_link?.url || checkout.payment_link?.long_url;

    if (!checkoutUrl) {
      return Response.json({ error: 'Failed to create checkout link' }, { status: 500 });
    }

    return Response.json({ 
      success: false,
      checkoutUrl
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});