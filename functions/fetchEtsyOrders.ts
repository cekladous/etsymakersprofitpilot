import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const etsyApiKey = Deno.env.get('ETSY_API_KEY');
    const etsySharedSecret = Deno.env.get('ETSY_SHARED_SECRET');

    if (!etsyApiKey || !etsySharedSecret) {
      return Response.json({ error: 'Etsy API credentials not configured' }, { status: 500 });
    }

    // Get user's Etsy settings from Settings entity
    const settings = await base44.entities.Settings.filter({
      owner_user_id: user.id,
      setting_key: 'etsy_config'
    });

    if (!settings || settings.length === 0) {
      return Response.json({ error: 'Etsy not configured for this user' }, { status: 400 });
    }

    const etsy_oauth_token = settings[0]?.etsy_oauth_token;
    if (!etsy_oauth_token) {
      return Response.json({ error: 'Etsy OAuth token not found' }, { status: 400 });
    }

    // Fetch shop ID
    const shopResponse = await fetch('https://openapi.etsy.com/v3/application/shops', {
      headers: {
        'x-api-key': etsyApiKey,
        'Authorization': `Bearer ${etsy_oauth_token}`
      }
    });

    if (!shopResponse.ok) {
      return Response.json({ error: 'Failed to fetch Etsy shop' }, { status: 500 });
    }

    const shopData = await shopResponse.json();
    const shopId = shopData.results[0]?.shop_id;

    // Fetch active listings
    const ordersResponse = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/orders`,
      {
        headers: {
          'x-api-key': etsyApiKey,
          'Authorization': `Bearer ${etsy_oauth_token}`
        }
      }
    );

    if (!ordersResponse.ok) {
      return Response.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const orders = await ordersResponse.json();
    return Response.json({ success: true, orders: orders.results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});