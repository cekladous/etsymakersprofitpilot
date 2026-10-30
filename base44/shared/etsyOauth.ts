import { secrets } from "base44:runtime";

export const ETSY_API = "https://api.etsy.com";

// Etsy allows exactly one registered callback URL per app, and it must match the
// published production host — including when the app is opened from the editor
// preview, since the browser leaves the preview and returns to production.
export const ETSY_CALLBACK_URL = "https://makersprofitpilot.base44.app/EtsyCallback";

export const ETSY_SCOPES = "transactions_r shops_r listings_r profile_r";

export function getRedirectUri() {
  return ETSY_CALLBACK_URL;
}

export function getKeystring() {
  return (secrets.get("ETSY_API_KEY") || "").trim();
}

export function getSharedSecret() {
  return (secrets.get("ETSY_SHARED_SECRET") || "").trim();
}

// Etsy v3 requires both credentials on every request, joined by a colon:
//   x-api-key: <keystring>:<shared_secret>
export function getApiKeyHeader() {
  const keystring = getKeystring();
  const secret = getSharedSecret();
  return secret ? `${keystring}:${secret}` : keystring;
}

export function etsyHeaders(accessToken) {
  const headers = { "x-api-key": getApiKeyHeader() };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

// Low-level Etsy call: returns the raw Response plus the parsed body so callers
// can report the exact HTTP status instead of guessing.
export async function etsyRequest(accessToken, path, init = {}) {
  const res = await fetch(`${ETSY_API}${path}`, {
    method: init.method || "GET",
    headers: { ...etsyHeaders(accessToken), ...(init.headers || {}) },
    body: init.body,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { res, body, text };
}

// Same call, but throws an Error carrying the Etsy status + message on failure.
export async function etsyJson(accessToken, path, init = {}) {
  const { res, body } = await etsyRequest(accessToken, path, init);
  if (!res.ok) {
    const detail = body?.error_description || body?.error || "request failed";
    const error = new Error(`Etsy API ${res.status}: ${detail}`);
    error.status = res.status;
    error.etsy_error = body?.error || null;
    throw error;
  }
  return body;
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

// Etsy access tokens look like "<numeric user_id>.<opaque token>", so the
// user_id can be read straight off the front of the token.
export function getUserIdFromToken(accessToken) {
  if (!accessToken || typeof accessToken !== "string") return null;
  const prefix = /^\d+/.exec(accessToken);
  if (prefix) return prefix[0];
  const parts = accessToken.split(".");
  if (parts.length >= 2) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload && payload.sub) return String(payload.sub);
    } catch {
      // not a JWT — no user_id available
    }
  }
  return null;
}

function shopFromBody(body) {
  const candidate = Array.isArray(body?.results) ? body.results[0] : body;
  if (!candidate || !candidate.shop_id) return null;
  return { shop_id: String(candidate.shop_id), shop_name: candidate.shop_name || "" };
}

function stepResult(step, res, body, shop) {
  return {
    step,
    status: res.status,
    ok: res.ok,
    error: res.ok ? null : body?.error_description || body?.error || "request failed",
    shop_id: shop?.shop_id || null,
  };
}

// Resolve the seller's shop from an access token.
// 1) GET /v3/application/users/me  -> user_id + shop_id
// 2) GET /v3/application/users/{user_id}/shops -> shop object
// Returns the resolved shop plus every step's HTTP status (never any secret).
export async function resolveEtsyShop(accessToken) {
  const steps = [];
  let shop = null;
  let userId = getUserIdFromToken(accessToken);

  const me = await etsyRequest(accessToken, "/v3/application/users/me");
  const meShop = shopFromBody(me.body);
  if (me.body?.user_id) userId = String(me.body.user_id);
  steps.push(stepResult("GET /v3/application/users/me", me.res, me.body, meShop));
  if (meShop) shop = meShop;

  if (!shop && userId) {
    const shops = await etsyRequest(accessToken, `/v3/application/users/${userId}/shops`);
    const found = shopFromBody(shops.body);
    steps.push(stepResult(`GET /v3/application/users/${userId}/shops`, shops.res, shops.body, found));
    if (found) shop = found;
  }

  // /users/me only carries the shop id; fetch the display name when missing.
  if (shop && !shop.shop_name) {
    const detail = await etsyRequest(accessToken, `/v3/application/shops/${shop.shop_id}`);
    const found = shopFromBody(detail.body);
    steps.push(stepResult(`GET /v3/application/shops/${shop.shop_id}`, detail.res, detail.body, found));
    if (found?.shop_name) shop = { ...shop, shop_name: found.shop_name };
  }

  return {
    shop_id: shop?.shop_id || "",
    shop_name: shop?.shop_name || "",
    user_id: userId || "",
    steps,
  };
}

// Kept for existing callers.
export async function getEtsyShop(accessToken) {
  const resolved = await resolveEtsyShop(accessToken);
  return { shop_id: resolved.shop_id, shop_name: resolved.shop_name, steps: resolved.steps };
}

// Refresh the access token if it is expired or close to expiry. Returns the
// (possibly updated) connection object with a valid access_token.
async function refreshIfNeeded(base44, conn) {
  const now = Date.now();
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (expiresAt && expiresAt - now > 5 * 60 * 1000) {
    return conn;
  }
  const { res, body } = await etsyRequest(null, "/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token || "",
      client_id: getKeystring(),
    }),
  });
  if (!res.ok || !body?.access_token) {
    const detail = body?.error_description || body?.error || `HTTP ${res.status}`;
    throw new Error(`Etsy token refresh failed: ${detail}`);
  }
  const newExpiresAt = body.expires_in
    ? new Date(Date.now() + body.expires_in * 1000).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const update = {
    access_token: body.access_token,
    refresh_token: body.refresh_token || conn.refresh_token,
    expires_at: newExpiresAt,
    scopes: body.scope || conn.scopes || "",
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