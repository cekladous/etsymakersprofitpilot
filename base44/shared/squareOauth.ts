import { secrets } from "base44:runtime";

export const SQUARE_API = "https://connect.squareup.com";
export const SQUARE_VERSION = "2024-08-21";

export async function squareFetch(token, path, options = {}) {
  const res = await fetch(`${SQUARE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = (body && body.errors && body.errors[0]) || {};
    throw new Error(err.detail || err.code || `Square API error (${res.status})`);
  }
  return body;
}

// Refresh the access token if it is expired or close to expiry. Returns the
// (possibly updated) connection object with a valid access_token.
async function refreshIfNeeded(base44, conn) {
  const now = Date.now();
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  // Keep a 5-minute buffer so the token is still valid when the call uses it.
  if (expiresAt && expiresAt - now > 5 * 60 * 1000) {
    return conn;
  }
  if (!conn.refresh_token) {
    return conn;
  }
  const clientId = secrets.get("SQUARE_OAUTH_CLIENT_ID");
  const clientSecret = secrets.get("SQUARE_OAUTH_CLIENT_SECRET");
  const res = await fetch(`${SQUARE_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  });
  const tok = await res.json();
  if (!tok.access_token) {
    throw new Error("Failed to refresh Square access token");
  }
  const newExpiresAt = tok.expires_at
    || (tok.expires_in
      ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const update = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || conn.refresh_token,
    expires_at: newExpiresAt,
  };
  await base44.asServiceRole.entities.SquareConnection.update(conn.id, update);
  return { ...conn, ...update };
}

// Get the current user's active Square connection (with a valid token).
export async function getUserSquareConnection(base44, userId) {
  if (!userId) return null;
  const conns = await base44.asServiceRole.entities.SquareConnection.filter({
    owner_user_id: userId,
    status: "active",
  });
  if (!conns || conns.length === 0) return null;
  return await refreshIfNeeded(base44, conns[0]);
}

// Look up a connection by Square merchant_id (used by the webhook to route
// events to the seller who owns that merchant).
export async function getConnectionByMerchant(base44, merchantId) {
  if (!merchantId) return null;
  const conns = await base44.asServiceRole.entities.SquareConnection.filter({
    merchant_id: merchantId,
    status: "active",
  });
  if (!conns || conns.length === 0) return null;
  return await refreshIfNeeded(base44, conns[0]);
}

// Revoke a seller's Square tokens server-side and mark the record disconnected.
export async function revokeConnection(base44, conn) {
  const clientId = secrets.get("SQUARE_OAUTH_CLIENT_ID");
  if (conn.access_token && conn.merchant_id) {
    try {
      await fetch(`${SQUARE_API}/oauth2/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Client ${clientId}`,
        },
        body: JSON.stringify({
          access_token: conn.access_token,
          merchant_id: conn.merchant_id,
        }),
      });
    } catch {
      // best-effort — proceed to mark disconnected locally either way
    }
  }
  await base44.asServiceRole.entities.SquareConnection.update(conn.id, {
    status: "disconnected",
    access_token: "",
    refresh_token: "",
  });
}