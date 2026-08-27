import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getKeystring, getRedirectUri, ETSY_SCOPES, generatePkce } from "../../shared/etsyOauth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const keystring = getKeystring();
    if (!keystring) {
      return Response.json({ error: "Etsy API key not configured for this app yet." }, { status: 500 });
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

    // Clean up any stale pending connections for this user, then create a fresh one.
    const pending = await base44.asServiceRole.entities.EtsyConnection.filter({
      owner_user_id: user.id,
      status: "pending",
    });
    for (const c of pending || []) {
      await base44.asServiceRole.entities.EtsyConnection.delete(c.id);
    }
    await base44.asServiceRole.entities.EtsyConnection.create({
      owner_user_id: user.id,
      status: "pending",
      oauth_state: state,
      code_verifier: verifier,
    });

    const redirectUri = getRedirectUri(req);
    const url =
      `https://www.etsy.com/oauth/connect?response_type=code` +
      `&client_id=${encodeURIComponent(keystring)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(ETSY_SCOPES)}` +
      `&state=${state}` +
      `&code_challenge=${encodeURIComponent(challenge)}` +
      `&code_challenge_method=S256`;

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}