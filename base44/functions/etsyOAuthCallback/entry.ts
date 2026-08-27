import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getKeystring, getRedirectUri, getEtsyShop } from "../../shared/etsyOauth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // The frontend callback page invokes this function with code + state in the
    // SDK payload (a JSON body).
    let body = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }

    const code = body.code || new URL(req.url).searchParams.get("code");
    const state = body.state || new URL(req.url).searchParams.get("state");
    const errorParam = body.error || new URL(req.url).searchParams.get("error");

    if (errorParam) return Response.json({ error: errorParam }, { status: 400 });
    if (!code || !state) return Response.json({ error: "missing_params" }, { status: 400 });

    const pending = await base44.asServiceRole.entities.EtsyConnection.filter({
      oauth_state: state,
      status: "pending",
    });
    if (!pending || pending.length === 0) {
      return Response.json({ error: "invalid_state" }, { status: 400 });
    }
    const conn = pending[0];

    const keystring = getKeystring();
    const redirectUri = getRedirectUri(req);

    const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: keystring,
        redirect_uri: redirectUri,
        code,
        code_verifier: conn.code_verifier || "",
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) {
      const detail = tok.error_description || tok.error || "unknown";
      return Response.json({ error: `token_exchange_failed: ${detail}`, etsy_error: tok.error || null }, { status: 200 });
    }

    const expiresAt = tok.expires_in
      ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Resolve the seller's shop for display.
    let shopId = "";
    let shopName = "";
    try {
      const shop = await getEtsyShop(tok.access_token, keystring);
      shopId = shop.shop_id;
      shopName = shop.shop_name;
    } catch {
      // shop resolution can be retried on import; don't fail the connection
    }

    await base44.asServiceRole.entities.EtsyConnection.update(conn.id, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token || "",
      expires_at: expiresAt,
      scopes: tok.scope || "",
      shop_id: shopId,
      shop_name: shopName,
      status: "active",
      connected_at: new Date().toISOString(),
      oauth_state: "",
      code_verifier: "",
    });

    return Response.json({ connected: true, shop_name: shopName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}