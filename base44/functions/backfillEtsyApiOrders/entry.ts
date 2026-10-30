import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getUserEtsyConnection, etsyJson } from "../../shared/etsyOauth.ts";
import {
  buildOrder,
  buildFees,
  netForOrder,
  fetchReceiptExtras,
  buildOrderIndex,
  buildFeeIndex,
  upsertReceipt,
  recomputeDailyDeposits,
} from "../../shared/etsyReceiptSync.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The platform caps entity writes per minute; honour the retry hint instead of
// failing a long repair half way through.
async function withRateLimitRetry(fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const match = /Retry after (\d+)s/.exec(err?.message || "");
      if (!match) throw err;
      await sleep((Number(match[1]) + 3) * 1000);
    }
  }
  throw new Error("Rate limit retries exhausted");
}

// One-off repair for orders that were imported before the Etsy Money mapping was
// fixed (every amount had been stored as $0.00). Re-reads each receipt from Etsy
// and updates the existing records in place — nothing is deleted.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    // Maintenance operation: re-writes financial records for a seller.
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const targetUserId = payload.owner_user_id || user.id;

    const conn = await getUserEtsyConnection(base44, targetUserId);
    if (!conn || !conn.shop_id) {
      return Response.json({ error: "Etsy connection not active for this seller" }, { status: 400 });
    }
    const shopId = conn.shop_id;

    const settingsRows = await base44.asServiceRole.entities.Settings.filter({ owner_user_id: targetUserId });
    const settings = (settingsRows && settingsRows[0]) || {};

    const orders = await base44.asServiceRole.entities.EtsyOrder.filter({ owner_user_id: targetUserId });
    const feeList = await base44.asServiceRole.entities.OrderFee.filter({ owner_user_id: targetUserId });
    const orderIndex = buildOrderIndex(orders);
    const feeIndex = buildFeeIndex(feeList);

    const apiOrders = (orders || []).filter((o) => o.source === "etsy_api");
    if (apiOrders.length === 0) {
      return Response.json({ updated: 0, created: 0, transfers: null, note: "no API orders to backfill" });
    }

    // Window: from two days before the oldest API order, to now.
    const oldest = apiOrders.map((o) => o.sale_date).filter(Boolean).sort()[0];
    const minCreated = Math.floor(new Date(`${oldest}T00:00:00Z`).getTime() / 1000) - 2 * 24 * 60 * 60;

    const limit = 100;
    let offset = 0;
    const stats = { updated: 0, created: 0, supersededCsv: 0, receiptsSeen: 0, failedReceipts: 0 };
    // Each repaired receipt costs two entity writes (order + fee). Stay under the
    // platform's 140 writes/minute by pausing every 16 receipts.
    let sinceLastPause = 0;

    while (true) {
      const body = await etsyJson(
        conn.access_token,
        `/v3/application/shops/${shopId}/receipts?min_created=${minCreated}&limit=${limit}&offset=${offset}`
      );
      const receipts = body.results || [];

      for (let i = 0; i < receipts.length; i += 5) {
        const chunk = receipts.slice(i, i + 5);
        const prepared = await Promise.all(
          chunk.map(async (r) => {
            try {
              const key = String(r.receipt_id || r.order_id || "");
              const known = orderIndex.get(`r:${key}`) || orderIndex.get(`o:${key}`);
              if (!known || known.source !== "etsy_api") return null; // only repair API-imported rows
              // Already repaired (real payment fees and a non-zero total): nothing to do.
              const knownFee = feeIndex.get(String(known.order_id));
              const alreadyGood =
                knownFee &&
                knownFee.fee_source === "etsy_payment_actual" &&
                Number(known.order_total) > 0;
              if (alreadyGood) return null;
              const extras = await fetchReceiptExtras(conn.access_token, shopId, r.receipt_id);
              const order = buildOrder(r, extras.transactions, extras.payments, targetUserId);
              const fees = buildFees(order, settings, extras.actualFee);
              order.order_net = netForOrder(order, fees);
              return { order, fees };
            } catch {
              stats.failedReceipts += 1;
              return null;
            }
          })
        );

        for (const item of prepared) {
          if (!item) continue;
          const res = await withRateLimitRetry(() =>
            upsertReceipt(base44, {
              userId: targetUserId,
              order: item.order,
              fees: item.fees,
              orderIndex,
              feeIndex,
              force: true,
            })
          );
          stats.receiptsSeen += 1;
          if (res.action === "updated") stats.updated += 1;
          else if (res.action === "created") stats.created += 1;
          else if (res.action === "superseded_csv") stats.supersededCsv += 1;

          sinceLastPause += 1;
          if (sinceLastPause >= 16) {
            await sleep(30000);
            sinceLastPause = 0;
          }
        }
      }

      const count = body.count || receipts.length;
      if (!(offset + limit < count && receipts.length === limit)) break;
      offset += limit;
    }

    const transfers = await withRateLimitRetry(() =>
      applyDailyDeposits(base44, targetUserId, dailyNet)
    );

    // Report any order that still carries a zero total after the repair.
    const after = await base44.asServiceRole.entities.EtsyOrder.filter({
      owner_user_id: targetUserId,
      source: "etsy_api",
    });
    const stillZero = (after || [])
      .filter((o) => !(Number(o.order_total) > 0))
      .map((o) => ({ order_id: o.order_id, sale_date: o.sale_date }));

    return Response.json({
      shop_id: shopId,
      ...stats,
      transfers,
      apiOrders: (after || []).length,
      stillZeroCount: stillZero.length,
      stillZero: stillZero.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}