import { secrets } from "base44:runtime";

export const ETSY_API = "https://api.etsy.com";
export const ETSY_OPEN_API = "https://openapi.etsy.com";
export const ETSY_SCOPES = "transactions_r shops_r listings_r";

// Redirect back to the frontend callback page (Etsy can only register one
// redirect URI per app). The page invokes etsyOAuthCallback via the SDK.
export function getRedirectUri(req) {
  // Prefer the app's published production host; fall back to the request origin.
  const origin = "https://makersprofitpilot.base44.app";
  return `${origin}/EtsyCallback`;
}

export function getKeystring() {
  return secrets.get("ETSY_API_KEY");
}

// Base64url encode a byte buffer.
function b64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Generate a PKCE code_verifier + code_challenge (S256).
export async function generatePkce() {
  const random = new Uint8Array(48);
  crypto.getRandomValues(random);
  const verifier = b64url(random);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = b64url(digest);
  return { verifier, challenge };
}

// Try to extract the Etsy user_id from an access token. Etsy v3 access tokens
// are JWTs whose `sub` claim holds the numeric user_id.
function extractUserId(accessToken) {
  if (!accessToken || typeof accessToken !== "string") return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload && payload.sub) return String(payload.sub);
  } catch {
    // not a JWT — fall through
  }
 return parts[0] || null;
}

// Resolve the seller's shop_id + shop_name from an access token.
export async function getEtsyShop(accessToken, keystring) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "x-api-key": keystring,
  };
  // Etsy v3: list shops owned by the authenticated user.
  const userId = extractUserId(accessToken);
  if (userId) {
    try {
      const res = await fetch(`${ETSY_OPEN_API}/v3/application/users/${userId}/shops`, { headers });
      if (res.ok) {
        const body = await res.json();
        const shop = (body.results || [])[0];
        if (shop) return { shop_id: String(shop.shop_id), shop_name: shop.shop_name || "" };
      }
    } catch {
      // try fallback below
    }
  }
  // Fallback: some accounts can list shops directly.
  try {
    const res = await fetch(`${ETSY_OPEN_API}/v3/application/shops`, { headers });
    if (res.ok) {
      const body = await res.json();
      const shop = (body.results || [])[0];
      if (shop) return { shop_id: String(shop.shop_id), shop_name: shop.shop_name || "" };
    }
  } catch {
    // ignore
  }
  return { shop_id: "", shop_name: "" };
}

// Refresh the access token if it is expired or close to expiry. Returns the
// (possibly updated) connection object with a valid access_token.
async function refreshIfNeeded(base44, conn) {
  const now = Date.now();
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (expiresAt && expiresAt - now > 5 * 60 * 1000) {
    return conn;
  }
  const keystring = getKeystring();
  const res = await fetch(`${ETSY_API}/v3/public/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      client_id: keystring,
    }),
  });
  const tok = await res.json();
  if (!tok.access_token) {
    throw new Error("Failed to refresh Etsy access token");
  }
  const newExpiresAt = tok.expires_in
    ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const update = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || conn.refresh_token,
    expires_at: newExpiresAt,
    scopes: tok.scope || conn.scopes || "",
  };
  await base44.asServiceRole.entities.EtsyConnection.update(conn.id, update);
  return { ...conn, ...update };
}

// Get the current user's active Etsy connection (with a valid token).
export async function getUserEtsyConnection(base44, userId) {
  if (!userId) return null;
  const conns = await base44.asServiceRole.entities.EtsyConnection.filter({
    owner_user_id: userId,
    status: "active",
  });
  if (!conns || conns.length === 0) return null;
  return await refreshIfNeeded(base44, conns[0]);
}

// List every active Etsy connection (used by the scheduled hourly import).
export async function getAllActiveEtsyConnections(base44) {
  const conns = await base44.asServiceRole.entities.EtsyConnection.filter({
    status: "active",
  });
  const valid = [];
  for (const c of conns || []) {
    try {
      valid.push(await refreshIfNeeded(base44, c));
    } catch {
      // a connection that can't be refreshed is skipped this run
    }
  }
  return valid;
}