import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, description, currency = 'USD' } = await req.json();

    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const squareApiKey = Deno.env.get('SQUARE_API_KEY');
    if (!squareApiKey) {
      return Response.json({ error: 'Square API key not configured' }, { status: 500 });
    }

    // Get user's Square settings
    const settings = await base44.entities.Settings.filter({
      owner_user_id: user.id,
      setting_key: 'square_config'
    });

    if (!settings || settings.length === 0) {
      return Response.json({ error: 'Square not configured for this user' }, { status: 400 });
    }

    const squareLocationId = settings[0]?.square_location_id;
    if (!squareLocationId) {
      return Response.json({ error: 'Square location ID not found' }, { status: 400 });
    }

    // Create Square payment - requires a valid card nonce from Square Payment Form
    // The source_id must be a tokenized card nonce from Square's Web Payment SDK
    const { sourceId } = await req.json();
    
    if (!sourceId || sourceId.startsWith('cnp:')) {
      return Response.json({ error: 'Valid payment token required' }, { status: 400 });
    }

    const paymentResponse = await fetch('https://connect.squareup.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${squareApiKey}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-01-14'
      },
      body: JSON.stringify({
        source_id: sourceId,
        amount_money: {
          amount: Math.round(amount * 100),
          currency: currency
        },
        location_id: squareLocationId,
        reference_id: `order_${user.id}_${Date.now()}`,
        note: description || 'Payment from Etsy Maker Profit Pilot'
      })
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.json();
      return Response.json({ error: 'Square payment failed', details: error }, { status: 400 });
    }

    const payment = await paymentResponse.json();
    return Response.json({ success: true, payment_id: payment.payment.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});