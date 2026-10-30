import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { getApiKeyHeader, getKeystring, getRedirectUri, resolveEtsyShop } from "../../shared/etsyOauth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // The frontend callback page invokes this function with code + state in the
    // SDK payload (a JSON body); the query-string form is kept for the redirect.
    let body = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    const reqUrl = new URL(req.url);

    const code = body.code || reqUrl.searchParams.get("code");
    const state = body.state || reqUrl.searchParams.get("state");
    const errorParam = body.error || reqUrl.searchParams.get("error");

    if (errorParam) return Response.json({ error: errorParam }, { status: 400 });
    if (!code || !state) return Response.json({ error: "missing_params" }, { status: 400 });

    // SECURITY: the pending connection must belong to the authenticated caller,
    // otherwise a leaked state value could bind a token to another user's record.
    const pending = await base44.asServiceRole.entities.EtsyConnection.filter({
      oauth_state: state,
      status: "pending",
      owner_user_id: user.id,
    });
    if (!pending || pending.length === 0) {
      return Response.json({ error: "invalid_state" }, { status: 400 });
    }
    const conn = pending[0];

    // Etsy requires the keystring:shared_secret form of x-api-key on API calls,
    // and PKCE code_verifier + the exact registered redirect_uri on exchange.
    const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-api-key": getApiKeyHeader(),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: getKeystring(),
        redirect_uri: getRedirectUri(),
        code,
        code_verifier: conn.code_verifier || "",
      }),
      signal: AbortSignal.timeout(20000),
    });
    const tok = await tokenRes.json().catch(() => null);
    if (!tok || !tok.access_token) {
      const detail = tok?.error_description || tok?.error || `HTTP ${tokenRes.status}`;
      return Response.json(
        { error: `token_exchange_failed: ${detail}`, etsy_status: tokenRes.status, etsy_error: tok?.error || null },
        { status: 200 }
      );
    }

    const expiresAt = tok.expires_in
      ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Resolve the seller's shop: users/me (user_id + shop_id), then
    // users/{user_id}/shops as the fallback.
    const shop = await resolveEtsyShop(tok.access_token);
    const failure = (shop.steps || []).find((s) => !s.ok);
    const shopError = failure
      ? `shop_lookup_failed (${failure.step} → ${failure.status}${failure.error ? ` ${failure.error}` : ""})`
      : "shop_lookup_failed (no shop returned)";

    await base44.asServiceRole.entities.EtsyConnection.update(conn.id, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token || "",
      expires_at: expiresAt,
      scopes: tok.scope || "",
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      status: "active",
      connected_at: new Date().toISOString(),
      oauth_state: "",
      code_verifier: "",
      last_error: shop.shop_id ? "" : shopError,
    });

    // Only one live shop per seller: retire any other active/pending record so a
    // shop-less leftover can never be picked instead of the real connection.
    const others = await base44.asServiceRole.entities.EtsyConnection.filter({
      owner_user_id: user.id,
    });
    for (const other of others || []) {
      if (other.id !== conn.id && other.status !== "disconnected") {
        await base44.asServiceRole.entities.EtsyConnection.update(other.id, {
          status: "disconnected",
          oauth_state: "",
          code_verifier: "",
        });
      }
    }

    if (!shop.shop_id) {
      return Response.json({ error: shopError, steps: shop.steps }, { status: 200 });
    }

    return Response.json({
      connected: true,
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      steps: shop.steps,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}