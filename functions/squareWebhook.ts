import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.text();
    const signature = req.headers.get('x-square-hmac-sha256');
    const webhookSecret = Deno.env.get('SQUARE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('SQUARE_WEBHOOK_SECRET not configured');
      return Response.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const encoder = new TextEncoder();
    const data = encoder.encode(webhookSecret + body);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedSignature = btoa(String.fromCharCode.apply(null, hashArray));

    if (computedSignature !== signature) {
      console.warn('Invalid webhook signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    const eventType = payload.type;
    const squareSubscriptionId = payload.data?.object?.subscription?.id;

    if (!squareSubscriptionId) {
      return Response.json({ success: true }, { status: 200 });
    }

    // Initialize Base44 SDK
    const base44 = createClientFromRequest(req);

    // Find subscription by square_subscription_id
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({
      square_subscription_id: squareSubscriptionId
    });

    if (subscriptions.length === 0) {
      console.warn(`No subscription found for Square ID: ${squareSubscriptionId}`);
      return Response.json({ success: true }, { status: 200 });
    }

    const subscription = subscriptions[0];
    const squareData = payload.data?.object?.subscription;

    // Handle different event types
    let updateData = {};

    if (eventType === 'subscription.created') {
      updateData = {
        status: 'active',
        square_subscription_id: squareSubscriptionId,
        current_period_start: squareData.start_date,
        current_period_end: squareData.billing_anchor_date
      };
    } else if (eventType === 'subscription.updated') {
      const squareStatus = squareData.state;

      // Map Square status to app status
      if (squareStatus === 'ACTIVE') {
        updateData = {
          status: 'active',
          current_period_start: squareData.start_date,
          current_period_end: squareData.billing_anchor_date,
          grace_period_end: null
        };
      } else if (squareStatus === 'CANCELED') {
        updateData = {
          status: 'canceled',
          canceled_at: new Date().toISOString()
        };
      }

      // Handle payment failures
      if (squareData.payment_method?.card?.card_status === 'FAILED') {
        updateData = {
          status: 'payment_failed',
          grace_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      }
    } else if (eventType === 'subscription.deleted') {
      updateData = {
        status: 'canceled',
        canceled_at: new Date().toISOString()
      };
    }

    // Update subscription if there's data to update
    if (Object.keys(updateData).length > 0) {
      await base44.asServiceRole.entities.Subscription.update(subscription.id, updateData);
      console.log(`Updated subscription ${subscription.id}:`, updateData);
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});