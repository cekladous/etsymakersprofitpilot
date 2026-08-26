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

    // If the user already has an active connection, no need to start again.
    const existing = await base44.asServiceRole.entities.SquareConnection.filter({
      owner_user_id: user.id,
      status: "active",
    });
    if (existing && existing.length > 0) {
      return Response.json({
        already_connected: true,
        merchant_id: existing[0].merchant_id,
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

    const scope =
      "ORDERS_WRITE+ORDERS_READ+INVOICES_WRITE+INVOICES_READ+PAYMENTS_READ+PAYMENTS_WRITE+CUSTOMERS_READ+CUSTOMERS_WRITE+MERCHANT_PROFILE_READ";
    const url =
      `${SQUARE_API}/oauth2/authorize?client_id=${clientId}` +
      `&scope=${scope}&session=false&state=${state}`;

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}