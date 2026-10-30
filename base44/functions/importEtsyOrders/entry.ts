import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getKeystring, getSharedSecret, getUserEtsyConnection, getAllActiveEtsyConnections, resolveEtsyShop, etsyJson } from "../../shared/etsyOauth.ts";
import { estimateOrderFees } from "../../shared/etsyFees.ts";
import { getEntitlements } from "../../shared/subscriptionGuard.ts";

function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dateStr(epochSeconds) {
  if (!epochSeconds) return new Date().toISOString().slice(0, 10);
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

// Every Etsy call goes through the shared client so it carries the required
// x-api-key: <keystring>:<shared_secret> header.
async function etsyFetch(token, keystring, path) {
  return etsyJson(token, path);
}

// Load the seller's fee Settings (one record per user keyed by setting_key).
async function loadSettings(base44, userId) {
  const rows = await base44.asServiceRole.entities.Settings.filter({ owner_user_id: userId });
  // Prefer the main settings record (any; the app keeps a single config record).
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
      // Free user with no Subscription row yet: start tracking so the limit
      // applies to them from now on.
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

  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let imported = 0;
  const dailyNet = {}; // YYYY-MM-DD -> net deposit sum

  // Collect existing etsy_api order_ids since the min date to dedupe.
  const existingIds = new Set();
  const existing = await base44.asServiceRole.entities.EtsyOrder.filter({
    owner_user_id: userId,
    source: "etsy_api",
  });
  for (const o of existing || []) {
    if (o.order_id) existingIds.add(o.order_id);
  }

  while (hasMore) {
    const body = await etsyFetch(
      conn.access_token,
      keystring,
      `/v3/application/shops/${shopId}/receipts?min_created=${minCreated}&limit=${limit}&offset=${offset}`
    );
    const receipts = body.results || [];
    for (const r of receipts) {
      const orderId = String(r.order_id || r.receipt_id);
      if (existingIds.has(orderId)) continue;

      // Fetch line-item transactions for item count / product / sku.
      let transactions = [];
      try {
        const tBody = await etsyFetch(
          conn.access_token,
          keystring,
          `/v3/application/shops/${shopId}/receipts/${r.receipt_id}/transactions`
        );
        transactions = tBody.results || [];
      } catch {
        transactions = [];
      }
      const itemCount = transactions.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0) || (Number(r.quantity) || 1);
      const productNames = transactions.map((t) => t.title).filter(Boolean).join("; ");
      const skus = transactions.map((t) => t.sku).filter(Boolean).join("; ");

      const orderValue = Number(r.subtotal) || Number(r.total_price) || 0;
      const shipping = Number(r.total_shipping_cost) || 0;
      const tax = Number(r.total_tax_cost) || 0;
      const discount = Number(r.discount_amount) || 0;
      const grandTotal = Number(r.grand_total) || (orderValue + shipping + tax - discount);

      const order = {
        owner_user_id: userId,
        sale_date: dateStr(r.create_date || r.created_timestamp),
        order_id: orderId,
        buyer_username: r.buyer_user_id ? String(r.buyer_user_id) : "",
        buyer_full_name: r.ship_name || r.name || "",
        first_name: r.first_name || "",
        last_name: r.last_name || "",
        number_of_items: itemCount,
        payment_method: r.payment_method || "etsy",
        sku: skus,
        product_name: productNames,
        order_value: round(orderValue),
        discount_amount: round(discount),
        shipping_charged: round(shipping),
        sales_tax: round(tax),
        order_total: round(grandTotal),
        currency: r.currency_code || "USD",
        status: r.was_shipped ? "shipped" : r.was_paid ? "paid" : "open",
        source: "etsy_api",
        statement_line_uid: `etsy_receipt_${r.receipt_id}`,
      };
      const fees = estimateOrderFees(order, settings);

      await base44.asServiceRole.entities.EtsyOrder.create(order);
      await base44.asServiceRole.entities.OrderFee.create({
        owner_user_id: userId,
        order_id: orderId,
        ...fees,
      });

      // Accumulate the expected daily deposit (order total minus tax & fees).
      const net = grandTotal - tax - fees.total_fees;
      const day = order.sale_date;
      dailyNet[day] = round((dailyNet[day] || 0) + net);
      imported += 1;
      existingIds.add(orderId);
    }

    const count = body.count || receipts.length;
    hasMore = offset + limit < count && receipts.length === limit;
    offset += limit;
  }

  // Upsert derived daily Etsy deposit Transfer records.
  for (const [day, net] of Object.entries(dailyNet)) {
    const note = `etsy_api_deposit_${day}`;
    const existingT = await base44.asServiceRole.entities.Transfer.filter({
      owner_user_id: userId,
      type: "etsy_deposit",
      notes: note,
    });
    if (existingT && existingT.length > 0) {
      await base44.asServiceRole.entities.Transfer.update(existingT[0].id, { amount: net, date: day });
    } else {
      await base44.asServiceRole.entities.Transfer.create({
        owner_user_id: userId,
        date: day,
        type: "etsy_deposit",
        amount: net,
        notes: note,
      });
    }
  }

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