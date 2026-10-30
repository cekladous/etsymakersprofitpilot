import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const SQUARE_API = "https://connect.squareup.com";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const clientId = secrets.get("SQUARE_OAUTH_CLIENT_ID");
    const clientSecret = secrets.get("SQUARE_OAUTH_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return Response.json(
        { error: "Square OAuth is not configured for this app yet." },
        { status: 500 }
      );
    }

    // A "Reconnect Square" request re-runs consent even when a connection exists
    // (needed when the stored grant is missing payment/webhook scopes).
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    // If the user already has an active connection, no need to start again.
    const existing = await base44.asServiceRole.entities.SquareConnection.filter({
      owner_user_id: user.id,
      status: "active",
    });
    if (existing && existing.length > 0 && !force) {
      return Response.json({
        already_connected: true,
        merchant_id: existing[0].merchant_id,
        scopes: existing[0].scopes || "",
      });
    }

    // Create a pending connection with a random state nonce so the callback
    // can verify the redirect belongs to this user.
    const state = crypto.randomUUID();
    const pending = await base44.asServiceRole.entities.SquareConnection.filter({
      owner_user_id: user.id,
      status: "pending",
    });
    for (const c of pending || []) {
      await base44.asServiceRole.entities.SquareConnection.delete(c.id);
    }
    await base44.asServiceRole.entities.SquareConnection.create({
      owner_user_id: user.id,
      status: "pending",
      oauth_state: state,
    });

    // Payment sync needs the read scopes for payments/orders/invoices/customers;
    // the webhook subscription scopes let the app register and verify its webhook.
    const scope = [
      "PAYMENTS_READ",
      "PAYMENTS_WRITE",
      "ORDERS_READ",
      "ORDERS_WRITE",
      "INVOICES_READ",
      "INVOICES_WRITE",
      "CUSTOMERS_READ",
      "CUSTOMERS_WRITE",
      "MERCHANT_PROFILE_READ",
      "ITEMS_READ",
      "INVENTORY_READ",
      "DEVELOPER_APPLICATION_WEBHOOKS_READ",
      "DEVELOPER_APPLICATION_WEBHOOKS_WRITE",
    ].join("+");
    // OAuth redirects back to a frontend page (not the function endpoint
    // directly), because Base44 function URLs reject unauthenticated browser
    // GET redirects. The page invokes squareOAuthCallback via the SDK.
    const redirectUri = "https://etsymakersprofitpilot.base44.app/SquareCallback";
    const url =
      `${SQUARE_API}/oauth2/authorize?client_id=${clientId}` +
      `&scope=${scope}&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}