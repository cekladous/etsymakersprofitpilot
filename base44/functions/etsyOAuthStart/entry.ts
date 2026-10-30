import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { getKeystring, getSharedSecret, getRedirectUri, ETSY_SCOPES, generatePkce } from "../../shared/etsyOauth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const keystring = getKeystring();
    if (!keystring) {
      return Response.json({ error: "Etsy API key not configured for this app yet." }, { status: 500 });
    }
    if (!getSharedSecret()) {
      return Response.json({ error: "Etsy shared secret not configured for this app yet." }, { status: 500 });
    }

    // If the user already has an active connection, no need to start again.
    const existing = await base44.asServiceRole.entities.EtsyConnection.filter({
      owner_user_id: user.id,
      status: "active",
    });
    if (existing && existing.length > 0) {
      return Response.json({
        already_connected: true,
        shop_name: existing[0].shop_name || existing[0].shop_id || "",
      });
    }

    const state = crypto.randomUUID();
    const { verifier, challenge } = await generatePkce();

    // Retire stale pending attempts instead of deleting them.
    const pending = await base44.asServiceRole.entities.EtsyConnection.filter({
      owner_user_id: user.id,
      status: "pending",
    });
    for (const c of pending || []) {
      await base44.asServiceRole.entities.EtsyConnection.update(c.id, {
        status: "disconnected",
        oauth_state: "",
        code_verifier: "",
      });
    }
    await base44.asServiceRole.entities.EtsyConnection.create({
      owner_user_id: user.id,
      status: "pending",
      oauth_state: state,
      code_verifier: verifier,
    });

    const redirectUri = getRedirectUri();
    const url =
      `https://www.etsy.com/oauth/connect?response_type=code` +
      `&client_id=${encodeURIComponent(keystring)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(ETSY_SCOPES)}` +
      `&state=${state}` +
      `&code_challenge=${encodeURIComponent(challenge)}` +
      `&code_challenge_method=S256`;

    return Response.json({ url, redirect_uri: redirectUri, scope: ETSY_SCOPES });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}