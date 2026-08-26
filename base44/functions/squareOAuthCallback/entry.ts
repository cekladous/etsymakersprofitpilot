import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const SQUARE_API = "https://connect.squareup.com";

export default async function (req) {
  const reqUrl = new URL(req.url);
  const appOrigin = reqUrl.origin;
  const redirect = (path) => Response.redirect(`${appOrigin}${path}`, 302);

  try {
    const code = reqUrl.searchParams.get("code");
    const state = reqUrl.searchParams.get("state");
    const errorParam = reqUrl.searchParams.get("error");

    if (errorParam) {
      return redirect(`/Settings?square_error=${encodeURIComponent(errorParam)}`);
    }
    if (!code || !state) {
      return redirect(`/Settings?square_error=missing_params`);
    }

    const base44 = createClientFromRequest(req);

    const pending = await base44.asServiceRole.entities.SquareConnection.filter({
      oauth_state: state,
      status: "pending",
    });
    if (!pending || pending.length === 0) {
      return redirect(`/Settings?square_error=invalid_state`);
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
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) {
      return redirect(
        `/Settings?square_error=${encodeURIComponent(tok.error || "token_exchange_failed")}`
      );
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

    return redirect(`/Settings?square_connected=1`);
  } catch (error) {
    return redirect(`/Settings?square_error=${encodeURIComponent(error.message)}`);
  }
}