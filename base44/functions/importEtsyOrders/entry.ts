import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getKeystring, getUserEtsyConnection, getAllActiveEtsyConnections, getEtsyShop, ETSY_OPEN_API } from "../../shared/etsyOauth.ts";
import { estimateOrderFees } from "../../shared/etsyFees.ts";

function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dateStr(epochSeconds) {
  if (!epochSeconds) return new Date().toISOString().slice(0, 10);
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

async function etsyFetch(token, keystring, path) {
  const res = await fetch(`${ETSY_OPEN_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "x-api-key": keystring },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Etsy API ${res.status}: ${body?.error || text || "request failed"}`);
  }
  return body;
}

// Load the seller's fee Settings (one record per user keyed by setting_key).
async function loadSettings(base44, userId) {
  const rows = await base44.asServiceRole.entities.Settings.filter({ owner_user_id: userId });
  // Prefer the main settings record (any; the app keeps a single config record).
  return (rows && rows[0]) || {};
}

// Import new orders for one Etsy connection. Returns counts.
async function importForConnection(base44, conn, keystring) {
  const userId = conn.owner_user_id;
  const settings = await loadSettings(base44, userId);

  // Resolve shop_id if it wasn't captured at connect time.
  let shopId = conn.shop_id;
  if (!shopId) {
    const shop = await getEtsyShop(conn.access_token, keystring);
    shopId = shop.shop_id;
    if (shopId) {
      await base44.asServiceRole.entities.EtsyConnection.update(conn.id, { shop_id: shopId, shop_name: shop.shop_name });
    }
  }
  if (!shopId) throw new Error("Could not resolve Etsy shop_id");

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
    const keystring = getKeystring();
    if (!keystring) return Response.json({ error: "Etsy API key not configured" }, { status: 500 });

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    // Determine scope: an explicit owner_user_id (Sync now) or auth context runs
    // for that user only; otherwise (scheduled automation) iterate all active connections.
    let userId = null;
    try {
      const u = await base44.auth.me();
      if (u) userId = u.id;
    } catch { /* scheduled: no user */ }
    if (payload.owner_user_id) userId = payload.owner_user_id;

    const results = [];
    if (userId) {
      const conn = await getUserEtsyConnection(base44, userId);
      if (!conn) return Response.json({ error: "Etsy not connected" }, { status: 400 });
      try {
        const r = await importForConnection(base44, conn, keystring);
        results.push({ user_id: userId, ...r });
      } catch (err) {
        await base44.asServiceRole.entities.EtsyConnection.update(conn.id, { last_error: err.message });
        results.push({ user_id: userId, error: err.message });
      }
    } else {
      const conns = await getAllActiveEtsyConnections(base44);
      for (const conn of conns) {
        try {
          const r = await importForConnection(base44, conn, keystring);
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