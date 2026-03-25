import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SQUARE_API_KEY = Deno.env.get('SQUARE_API_KEY');
const SQUARE_API_URL = 'https://squareup.com/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, nonce } = await req.json();

    // Map plan to Square plan ID
    const squarePlanMap = {
      maker_pro: 'SQ_MAKER_PRO_9',
      maker_plus: 'SQ_MAKER_PLUS_14'
    };

    const squarePlanId = squarePlanMap[planId];
    if (!squarePlanId) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Create customer in Square
    const customerRes = await fetch(`${SQUARE_API_URL}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        given_name: user.full_name?.split(' ')[0] || 'Maker',
        family_name: user.full_name?.split(' ')[1] || '',
        email_address: user.email
      })
    });

    if (!customerRes.ok) {
      throw new Error(`Square customer creation failed: ${customerRes.status}`);
    }

    const customer = await customerRes.json();
    const squareCustomerId = customer.customer.id;

    // Create card from nonce
    const cardRes = await fetch(`${SQUARE_API_URL}/customer-cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: squareCustomerId,
        source_id: nonce
      })
    });

    if (!cardRes.ok) {
      throw new Error(`Square card creation failed: ${cardRes.status}`);
    }

    const card = await cardRes.json();
    const cardId = card.card.id;

    // Create subscription
    const now = new Date();
    const subRes = await fetch(`${SQUARE_API_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: squarePlanId,
        customer_id: squareCustomerId,
        start_date: now.toISOString().split('T')[0],
        card_id: cardId,
        timezone: 'America/New_York'
      })
    });

    if (!subRes.ok) {
      throw new Error(`Square subscription creation failed: ${subRes.status}`);
    }

    const subscription = await subRes.json();
    const squareSubId = subscription.subscription.id;

    // Save subscription to database
    const dbSub = await base44.entities.Subscription.create({
      owner_user_id: user.id,
      plan_id: planId,
      status: 'active',
      square_subscription_id: squareSubId,
      square_customer_id: squareCustomerId,
      current_period_start: now.toISOString().split('T')[0],
      current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      imports_used_this_month: 0,
      active_users: planId === 'maker_plus' ? 2 : 1,
      founders_pricing: true
    });

    return Response.json({ 
      success: true,
      subscription: dbSub
    });
  } catch (error) {
    console.error('Subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});