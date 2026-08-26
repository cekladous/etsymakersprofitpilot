import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const SQUARE_API = "https://connect.squareup.com";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The frontend callback page invokes this function with code + state in
    // the SDK payload (a JSON body), so we read from the request body instead
    // of the URL.
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

    if (errorParam) {
      return Response.json({ error: errorParam }, { status: 400 });
    }
    if (!code || !state) {
      return Response.json({ error: "missing_params" }, { status: 400 });
    }

    const pending = await base44.asServiceRole.entities.SquareConnection.filter({
      oauth_state: state,
      status: "pending",
    });
    if (!pending || pending.length === 0) {
      return Response.json({ error: "invalid_state" }, { status: 400 });
    }
    const conn = pending[0];

    const clientId = secrets.get("SQUARE_OAUTH_CLIENT_ID");
    const clientSecret = secrets.get("SQUARE_OAUTH_CLIENT_SECRET");

    const tokenRes = await fetch(`${SQUARE_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: "https://etsymakersprofitpilot.base44.app/SquareCallback",
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) {
      // Return 200 with the real Square error in the body so the frontend
      // (which throws on non-2xx and hides the message) can surface it.
      return Response.json({
        error: "token_exchange_failed",
        square_error: tok.error || null,
        square_message: tok.error_description || tok.message || null,
        square_response: tok,
        http_status: tokenRes.status,
      }, { status: 200 });
    }

    const expiresAt = tok.expires_at
      || (tok.expires_in
        ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    // Look up the merchant's business name for a friendly display.
    let merchantName = "";
    try {
      const limitRes = await fetch(`${SQUARE_API}/v2/locations`, {
        headers: {
          Authorization: `Bearer ${tok.access_token}`,
          "Square-Version": "2024-08-21",
        },
      });
      const locBody = await limitRes.json();
      const loc = (locBody.locations || []).find((l) => l.status === "ACTIVE") || (locBody.locations || [])[0];
      merchantName = loc ? loc.name : "";
    } catch {
      merchantName = "";
    }

    await base44.asServiceRole.entities.SquareConnection.update(conn.id, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token || "",
      expires_at: expiresAt,
      merchant_id: tok.merchant_id || "",
      merchant_name: merchantName,
      scopes: tok.scope || "",
      status: "active",
      connected_at: new Date().toISOString(),
      oauth_state: "",
    });

    return Response.json({ connected: true, merchant_name: merchantName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}