import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getKeystring, getSharedSecret, getUserEtsyConnection, getAllActiveEtsyConnections, resolveEtsyShop, etsyJson } from "../../shared/etsyOauth.ts";
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
import { getEntitlements } from "../../shared/subscriptionGuard.ts";

// Load the seller's fee Settings (one record per user keyed by setting_key).
async function loadSettings(base44, userId) {
  const rows = await base44.asServiceRole.entities.Settings.filter({ owner_user_id: userId });
  return (rows && rows[0]) || {};
}

// Resolve the shop owner's identity for entitlement checks. The stored role is
// used when available; otherwise the least-privileged identity is assumed.
async function resolveOwner(base44, userId) {
  try {
    const u = await base44.asServiceRole.entities.User.get(userId);
    if (u?.id) return { id: u.id, role: u.role || "user" };
  } catch {
    // fall through to the least-privileged identity
  }
  return { id: userId, role: "user" };
}

// SECURITY: paid import volume is enforced here, on the server. The browser
// gate in useFeatureAccess is UX only; a direct call to this function must not
// get unlimited Etsy imports on a Free plan.
function withinImportAllowance(entitlements) {
  if (entitlements.features.monthly_imports === -1) return true;
  const used = Number(entitlements.subscription?.imports_used_this_month || 0);
  return used < entitlements.features.monthly_imports;
}

// Consume one monthly import — only after an import actually produced new
// orders, so a no-op sync never burns the plan's quota.
async function consumeImportUse(base44, entitlements, userId, imported) {
  if (!imported || imported <= 0) return;
  try {
    if (entitlements.subscription?.id) {
      await base44.asServiceRole.entities.Subscription.updateMany(
        { id: entitlements.subscription.id },
        { $inc: { imports_used_this_month: 1 } }
      );
    } else if (entitlements.plan === "free") {
      await base44.asServiceRole.entities.Subscription.create({
        owner_user_id: userId,
        plan_id: "free",
        status: "active",
        imports_used_this_month: 1,
      });
    }
  } catch (err) {
    console.error("Failed to record Etsy import usage:", err.message);
  }
}

// Import new orders for one Etsy connection. Returns counts.
async function importForConnection(base44, conn, keystring) {
  const userId = conn.owner_user_id;
  const settings = await loadSettings(base44, userId);

  // Resolve shop_id if it wasn't captured at connect time.
  let shopId = conn.shop_id;
  if (!shopId) {
    const shop = await resolveEtsyShop(conn.access_token);
    shopId = shop.shop_id;
    if (shopId) {
      await base44.asServiceRole.entities.EtsyConnection.update(conn.id, { shop_id: shopId, shop_name: shop.shop_name });
    } else {
      const failure = (shop.steps || []).find((s) => !s.ok);
      throw new Error(
        `Could not resolve Etsy shop_id (${failure ? `${failure.step} → ${failure.status} ${failure.error || ""}`.trim() : "no shop returned"})`
      );
    }
  }

  // Pull receipts created since the last sync (default: last 90 days).
  const minCreated = conn.last_sync_at
    ? Math.floor(new Date(conn.last_sync_at).getTime() / 1000)
    : Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

  // Index every existing order + fee for this seller so a re-sync updates in
  // place instead of inserting a second copy of the same receipt.
  const orderIndex = buildOrderIndex(
    await base44.asServiceRole.entities.EtsyOrder.filter({ owner_user_id: userId })
  );
  const feeIndex = buildFeeIndex(
    await base44.asServiceRole.entities.OrderFee.filter({ owner_user_id: userId })
  );

  const limit = 100;
  let offset = 0;
  let imported = 0;

  while (true) {
    const body = await etsyJson(
      conn.access_token,
      `/v3/application/shops/${shopId}/receipts?min_created=${minCreated}&limit=${limit}&offset=${offset}`
    );
    const receipts = body.results || [];

    // Batches of 5 receipts (each needs two extra calls) to stay inside the
    // worker's connection budget.
    for (let i = 0; i < receipts.length; i += 5) {
      const chunk = receipts.slice(i, i + 5);
      const prepared = await Promise.all(
        chunk.map(async (r) => {
          const key = String(r.receipt_id || r.order_id || "");
          if (!key) return null;
          const already = orderIndex.get(`r:${key}`) || orderIndex.get(`o:${key}`);
          if (already && already.source === "etsy_api") return null; // already imported
          const extras = await fetchReceiptExtras(conn.access_token, shopId, r.receipt_id);
          const order = buildOrder(r, extras.transactions, extras.payments, userId);
          const fees = buildFees(order, settings, extras.actualFee);
          order.order_net = netForOrder(order, fees);
          return { order, fees };
        })
      );

      for (const item of prepared) {
        if (!item) continue;
        const res = await upsertReceipt(base44, {
          userId,
          order: item.order,
          fees: item.fees,
          orderIndex,
          feeIndex,
        });
        if (res.action === "skipped") continue;
        imported += 1;
      }
    }

    const count = body.count || receipts.length;
    if (!(offset + limit < count && receipts.length === limit)) break;
    offset += limit;
  }

  await recomputeDailyDeposits(base44, userId);

  await base44.asServiceRole.entities.EtsyConnection.update(conn.id, {
    last_sync_at: new Date().toISOString(),
    last_imported_count: imported,
    last_error: "",
  });
  return { imported };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // SECURITY: this handler performs outbound Etsy API calls and writes financial
    // records with service-role privileges, so the caller must be authenticated.
    // Scheduled workflow runs arrive as the workflow owner (an app admin).
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const keystring = getKeystring();
    if (!keystring) return Response.json({ error: "Etsy API key not configured" }, { status: 500 });
    if (!getSharedSecret()) {
      return Response.json({ error: "Etsy shared secret not configured" }, { status: 500 });
    }

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    // Determine scope from the authenticated caller only — a client-supplied
    // owner_user_id is never trusted. The manual "Sync now" button requests the
    // caller's own scope; only an admin may run the all-connections broadcast
    // (which is how the scheduled automation runs).
    const isAdmin = user.role === "admin";
    const wantsUserScope = payload.scope === "user" || payload.owner_user_id;
    const userId = (wantsUserScope || !isAdmin) ? user.id : null;

    const results = [];
    if (userId) {
      const conn = await getUserEtsyConnection(base44, userId);
      if (!conn) {
        return Response.json(
          { syncs: [{ user_id: userId, skipped: "etsy_not_connected" }] },
          { status: 200 }
        );
      }
      const entitlements = await getEntitlements(base44, user);
      if (!withinImportAllowance(entitlements)) {
        return Response.json(
          {
            error: "Your plan's monthly Etsy import limit is used up. Upgrade your plan to keep syncing.",
            code: "import_limit_reached",
          },
          { status: 403 }
        );
      }

      try {
        const r = await importForConnection(base44, conn, keystring);
        await consumeImportUse(base44, entitlements, userId, r.imported);
        results.push({ user_id: userId, ...r });
      } catch (err) {
        await base44.asServiceRole.entities.EtsyConnection.update(conn.id, { last_error: err.message });
        results.push({ user_id: userId, error: err.message });
      }
    } else {
      const conns = await getAllActiveEtsyConnections(base44);
      if (!conns || conns.length === 0) {
        return Response.json(
          { syncs: [], skipped: "no_active_connections" },
          { status: 200 }
        );
      }
      for (const conn of conns) {
        try {
          // SECURITY: the scheduled broadcast imports on behalf of each shop
          // owner, so their own plan limit applies to them here too.
          const owner = await resolveOwner(base44, conn.owner_user_id);
          const entitlements = await getEntitlements(base44, owner);
          if (!withinImportAllowance(entitlements)) {
            results.push({ user_id: conn.owner_user_id, skipped: "import_limit_reached" });
            continue;
          }
          const r = await importForConnection(base44, conn, keystring);
          await consumeImportUse(base44, entitlements, conn.owner_user_id, r.imported);
          results.push({ user_id: conn.owner_user_id, ...r });
        } catch (err) {
          await base44.asServiceRole.entities.EtsyConnection.update(conn.id, { last_error: err.message });
          results.push({ user_id: conn.owner_user_id, error: err.message });
        }
      }
    }

    return Response.json({ syncs: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}