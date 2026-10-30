import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { getUserSquareConnection, SQUARE_API, SQUARE_VERSION } from "../../shared/squareOauth.ts";

const WEBHOOK_URL = "https://makersprofitpilot.base44.app/functions/squareWebhook";
const EVENT_TYPES = ["payment.updated", "invoice.updated", "invoice.payment_made", "refund.updated"];

async function squareCall(token, path, options = {}) {
  const res = await fetch(`${SQUARE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/**
 * Verifies (and, for an admin, registers) the Square webhook subscription for
 * payment.updated / invoice.updated / invoice.payment_made / refund.updated.
 * Registration needs DEVELOPER_APPLICATION_WEBHOOKS_* on the connection; when
 * Square refuses, the hourly scheduled sync is the fallback and the response
 * tells the user what to add in the Square Developer Console.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === "admin";
    const conn = await getUserSquareConnection(base44, user.id);
    const token = conn?.access_token;
    if (!token) {
      return Response.json({ error: "Connect Square first." }, { status: 400 });
    }

    const list = await squareCall(token, "/v2/webhooks/subscriptions");
    if (list.status === 403) {
      return Response.json({
        registered: false,
        needs_manual_setup: true,
        url: WEBHOOK_URL,
        event_types: EVENT_TYPES,
        message:
          "Reconnect Square to grant webhook permissions, or register the webhook in the Square Developer Console. The hourly scheduled sync keeps data current either way.",
      });
    }
    if (list.status >= 400) {
      return Response.json({ error: list.body?.errors?.[0]?.detail || `Square error (${list.status})` }, { status: 400 });
    }

    const subscriptions = list.body?.subscriptions || [];
    const existing = subscriptions.find((sub) => sub.notification_url === WEBHOOK_URL);

    if (existing) {
      const missing = EVENT_TYPES.filter((type) => !(existing.event_types || []).includes(type));
      if (missing.length === 0) {
        return Response.json({ registered: true, enabled: existing.enabled !== false, url: WEBHOOK_URL, event_types: EVENT_TYPES });
      }
      if (!isAdmin) {
        return Response.json({ registered: false, needs_manual_setup: true, url: WEBHOOK_URL, event_types: EVENT_TYPES, missing_events: missing });
      }
      const updated = await squareCall(token, `/v2/webhooks/subscriptions/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify({ subscription: { ...existing, event_types: [...new Set([...(existing.event_types || []), ...missing])] } }),
      });
      return Response.json({
        registered: updated.status < 400,
        updated: true,
        url: WEBHOOK_URL,
        event_types: EVENT_TYPES,
        error: updated.status >= 400 ? (updated.body?.errors?.[0]?.detail || "Update failed") : null,
      });
    }

    if (!isAdmin) {
      return Response.json({ registered: false, needs_manual_setup: true, url: WEBHOOK_URL, event_types: EVENT_TYPES });
    }

    const created = await squareCall(token, "/v2/webhooks/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        subscription: {
          name: "Maker's Profit Pilot payments",
          notification_url: WEBHOOK_URL,
          event_types: EVENT_TYPES,
          enabled: true,
        },
      }),
    });

    return Response.json({
      registered: created.status < 400,
      created: created.status < 400,
      url: WEBHOOK_URL,
      event_types: EVENT_TYPES,
      error: created.status >= 400
        ? (created.body?.errors?.[0]?.detail || `Square error (${created.status})`)
        : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}