import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { getUserSquareConnection } from "../../shared/squareOauth.ts";
import { linkSquarePaymentToOrder, unlinkSquarePaymentFromOrder } from "../../shared/squareSync.ts";

/**
 * Manual Square ↔ Etsy link control, scoped to the signed-in seller's own data.
 * body: { action: "link" | "unlink", etsy_order_id, square_payment_id? }
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toLowerCase();
    const orderId = String(body.etsy_order_id || "").trim();
    if (!orderId) return Response.json({ error: "etsy_order_id is required" }, { status: 400 });

    const orders = await base44.asServiceRole.entities.EtsyOrder.filter({ id: orderId, owner_user_id: user.id });
    if (!orders || orders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const conn = await getUserSquareConnection(base44, user.id);
    if (!conn) {
      return Response.json({ error: "Connect Square first, then link payments." }, { status: 400 });
    }

    if (action === "unlink") {
      const result = await unlinkSquarePaymentFromOrder(base44, {
        ownerUserId: user.id,
        orderId,
        conn,
      });
      return Response.json({ ok: true, ...result });
    }

    if (action !== "link") {
      return Response.json({ error: "action must be link or unlink" }, { status: 400 });
    }

    const paymentId = String(body.square_payment_id || "").trim();
    if (!paymentId) return Response.json({ error: "square_payment_id is required" }, { status: 400 });

    try {
      const result = await linkSquarePaymentToOrder(base44, {
        ownerUserId: user.id,
        orderId,
        conn,
        paymentId,
      });
      return Response.json({ ok: true, ...result });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}