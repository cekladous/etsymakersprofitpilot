// Shared Etsy receipt -> EtsyOrder / OrderFee mapping.
// Used by both the hourly sync (importEtsyOrders) and the one-off backfill
// (backfillEtsyApiOrders) so the two can never drift apart.
//
// Etsy v3 returns EVERY monetary value as a Money object:
//   grandtotal: { amount: 4500, divisor: 100, currency_code: "USD" }  =>  $45.00
// Reading it with Number() yields NaN -> 0, which is what zeroed out the first
// set of API imports.

import { etsyJson } from "./etsyOauth.ts";

/** Etsy Money object -> dollars. */
export function money(value) {
  if (!value || typeof value !== "object") return 0;
  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) return 0;
  const divisor = Number(value.divisor) || 100;
  return amount / divisor;
}

export function round(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function epochToDate(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString().slice(0, 10);
  return new Date(n * 1000).toISOString().slice(0, 10);
}

/** Sum refunds from the receipt and from the payment adjustments (whichever carries them). */
function refundTotal(receipt, payments) {
  let total = 0;
  const direct = receipt?.refunds;
  const rows = Array.isArray(direct?.results) ? direct.results : Array.isArray(direct) ? direct : [];
  for (const r of rows) total += Math.abs(money(r.amount));
  for (const p of payments || []) {
    const adj = p?.payment_adjustments;
    const adjustments = Array.isArray(adj?.results) ? adj.results : Array.isArray(adj) ? adj : [];
    for (const a of adjustments) {
      const v = money(a.amount);
      if (v < 0) total += Math.abs(v);
    }
  }
  return round(total);
}

/** Etsy's real processing fee taken on the payment record, in dollars. */
export function actualProcessingFees(payments) {
  return round((payments || []).reduce((sum, p) => sum + money(p?.amount_fees), 0));
}

/**
 * Map one Etsy receipt (+ its transactions and payment records) to EtsyOrder fields.
 */
export function buildOrder(receipt, transactions, payments, userId) {
  const txns = Array.isArray(transactions) ? transactions : [];
  const txItemTotal = txns.reduce((sum, t) => sum + money(t.price) * (num(t.quantity) || 1), 0);
  const txShipping = txns.reduce((sum, t) => sum + money(t.shipping_cost), 0);
  const itemCount = txns.reduce((sum, t) => sum + (num(t.quantity) || 0), 0) || 1;

  const itemTotal = money(receipt.subtotal) || money(receipt.total_price) || txItemTotal;
  const shipping = money(receipt.total_shipping_cost) || txShipping;
  const tax = money(receipt.total_tax_cost) + money(receipt.total_vat_cost);
  const discount = money(receipt.discount_amt);
  const giftWrap = money(receipt.gift_wrap_price);
  const orderTotal = money(receipt.grandtotal) || itemTotal + shipping + tax - discount + giftWrap;
  const receiptId = String(receipt.receipt_id || receipt.order_id || "");

  const titles = txns.map((t) => t.title).filter(Boolean);
  const skus = txns.map((t) => t.sku).filter(Boolean);

  return {
    owner_user_id: userId,
    receipt_id: receiptId,
    sale_date: epochToDate(receipt.created_timestamp || receipt.create_timestamp),
    order_id: String(receipt.order_id || receipt.receipt_id || ""),
    buyer_username: receipt.buyer_user_id ? String(receipt.buyer_user_id) : "",
    buyer_full_name: receipt.name || receipt.ship_name || "",
    first_name: "",
    last_name: "",
    number_of_items: itemCount,
    payment_method: receipt.payment_method || "etsy",
    sku: [...new Set(skus)].join("; "),
    product_name: [...new Set(titles)].join("; "),
    order_value: round(itemTotal),
    discount_amount: round(discount),
    shipping_charged: round(shipping),
    sales_tax: round(tax),
    refund_amount: refundTotal(receipt, payments),
    order_total: round(orderTotal),
    card_processing_fees: actualProcessingFees(payments),
    currency: receipt.currency_code || "USD",
    status: receipt.status || "",
    source: "etsy_api",
    statement_line_uid: `etsy_receipt_${receiptId}`,
  };
}

/**
 * Fee breakdown for one order.
 * - Etsy's real payment record supplies the processing fee when it exists.
 * - Transaction (6.5% of items + shipping) and listing ($0.20 per item) fees are
 *   charged to the seller's Etsy account, not the payment, and the payment-account
 *   ledger endpoint is not available to us — so those stay rate-based estimates and
 *   are labelled as such.
 * - Offsite ads / Share & Save are never estimated: they are only booked when Etsy's
 *   own data reports them.
 */
export function buildFees(order, settings, actualPaymentFee = 0) {
  const s = settings || {};
  const listingFeeRate = num(s.etsy_listing_fee ?? 0.2);
  const txnPct = num(s.etsy_transaction_fee_percent ?? 6.5);
  const procPct = num(s.payment_processing_fee_percent ?? 3.0);
  const procFixed = num(s.payment_processing_fee_fixed ?? 0.25);

  const items = num(order.order_value);
  const shipping = num(order.shipping_charged);
  const tax = num(order.sales_tax);
  const discount = num(order.discount_amount);
  const refund = num(order.refund_amount);
  const qty = num(order.number_of_items) || 1;

  const sellable = Math.max(0, items + shipping - discount - refund);
  const listing = listingFeeRate * qty;
  const transaction = sellable * txnPct / 100;

  const actual = num(actualPaymentFee);
  const hasActual = actual > 0;
  const processing = hasActual
    ? actual
    : Math.max(0, sellable + tax) * procPct / 100 + procFixed;

  const totalFees = round(listing + transaction + processing);

  return {
    listing_fees: round(listing),
    transaction_fees: round(transaction),
    processing_fees: round(processing),
    share_save_credit: 0,
    other_fees: 0,
    etsy_ads: 0,
    offsite_ads_fees: 0,
    etsy_shipping: 0,
    other_postage_costs: 0,
    total_fees: totalFees,
    fee_source: hasActual ? "etsy_payment_actual" : "estimated",
    estimated_parts: hasActual ? "listing,transaction" : "listing,transaction,processing",
  };
}

/** Net = order total − refunds − sales tax Etsy remits − every Etsy fee. */
export function netForOrder(order, fees) {
  return round(
    num(order.order_total) - num(order.refund_amount) - num(order.sales_tax) - num(fees.total_fees)
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Etsy throttles bursty traffic; a failed sub-call would silently downgrade real
// payment fees to estimates, so retry before giving up.
async function etsyJsonRetry(token, path, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await etsyJson(token, path);
    } catch (err) {
      lastError = err;
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastError;
}

/** Fetch the per-receipt extras (line items + payment record) without failing the whole sync. */
export async function fetchReceiptExtras(token, shopId, receiptId) {
  const base = `/v3/application/shops/${shopId}/receipts/${receiptId}`;
  const [txRes, payRes] = await Promise.allSettled([
    etsyJsonRetry(token, `${base}/transactions`),
    etsyJsonRetry(token, `${base}/payments`),
  ]);
  const transactions = txRes.status === "fulfilled" ? txRes.value?.results || [] : [];
  const payments = payRes.status === "fulfilled" ? payRes.value?.results || [] : [];
  return { transactions, payments, actualFee: actualProcessingFees(payments) };
}

export function buildOrderIndex(orders) {
  const index = new Map();
  for (const o of orders || []) {
    if (o.receipt_id) index.set(`r:${o.receipt_id}`, o);
    if (o.statement_line_uid?.startsWith("etsy_receipt_")) {
      index.set(`r:${o.statement_line_uid.replace("etsy_receipt_", "")}`, o);
    }
    if (o.order_id && !index.has(`o:${o.order_id}`)) index.set(`o:${o.order_id}`, o);
  }
  return index;
}

export function buildFeeIndex(fees) {
  const index = new Map();
  for (const f of fees || []) if (f.order_id) index.set(String(f.order_id), f);
  return index;
}

/**
 * Upsert one receipt.
 * - Same receipt already imported from the API -> update in place (re-sync never duplicates).
 * - A CSV/statement record covers the same receipt -> keep the API record and mark the
 *   CSV one superseded (never deleted).
 */
export async function upsertReceipt(base44, { userId, order, fees, orderIndex, feeIndex, force = false }) {
  const existing = orderIndex.get(`r:${order.receipt_id}`) || orderIndex.get(`o:${order.order_id}`);

  if (existing && existing.source === "etsy_api" && !force) {
    return { action: "skipped", orderId: existing.id };
  }

  let orderId = null;
  let action = "created";
  if (existing && existing.source === "etsy_api") {
    await base44.asServiceRole.entities.EtsyOrder.update(existing.id, order);
    orderId = existing.id;
    action = "updated";
  } else if (existing) {
    const created = await base44.asServiceRole.entities.EtsyOrder.create(order);
    orderId = created.id;
    await base44.asServiceRole.entities.EtsyOrder.update(existing.id, {
      superseded: true,
      superseded_by: created.id,
    });
    action = "superseded_csv";
  } else {
    const created = await base44.asServiceRole.entities.EtsyOrder.create(order);
    orderId = created.id;
  }

  const feePayload = { owner_user_id: userId, order_id: order.order_id, ...fees };
  const feeRecord = feeIndex.get(String(order.order_id));
  if (feeRecord) {
    await base44.asServiceRole.entities.OrderFee.update(feeRecord.id, feePayload);
  } else {
    const createdFee = await base44.asServiceRole.entities.OrderFee.create(feePayload);
    feeIndex.set(String(order.order_id), createdFee);
  }

  const fresh = { ...order, id: orderId };
  orderIndex.set(`r:${order.receipt_id}`, fresh);
  orderIndex.set(`o:${order.order_id}`, fresh);
  return { action, orderId };
}

/**
 * Upsert the derived per-day Etsy deposit Transfers.
 * A day whose net is zero or negative is not a deposit: the row is voided
 * (amount 0 + voided flag) rather than deleted.
 */
export async function applyDailyDeposits(base44, userId, dailyNet) {
  const existing = await base44.asServiceRole.entities.Transfer.filter({
    owner_user_id: userId,
    type: "etsy_deposit",
  });
  const byNote = new Map((existing || []).map((t) => [t.notes, t]));
  const result = { upserted: 0, voided: 0 };

  for (const [day, rawNet] of Object.entries(dailyNet)) {
    const note = `etsy_api_deposit_${day}`;
    const net = round(rawNet);
    const found = byNote.get(note);
    const unchanged = found && !found.voided && round(found.amount) === net;
    if (net > 0) {
      if (found && !unchanged) {
        await base44.asServiceRole.entities.Transfer.update(found.id, {
          amount: net,
          date: day,
          voided: false,
          void_reason: "",
        });
      } else if (!found) {
        await base44.asServiceRole.entities.Transfer.create({
          owner_user_id: userId,
          date: day,
          type: "etsy_deposit",
          amount: net,
          notes: note,
          voided: false,
        });
      }
      result.upserted += 1;
    } else if (found && !found.voided) {
      await base44.asServiceRole.entities.Transfer.update(found.id, {
        amount: 0,
        voided: true,
        void_reason: "Order total did not exceed Etsy fees — not a real deposit",
      });
      result.voided += 1;
    }
  }

  // Sweep older synthetic transfers that still carry a negative amount.
  for (const t of existing || []) {
    const isSynthetic = (t.notes || "").startsWith("etsy_api_deposit_");
    if (isSynthetic && !t.voided && num(t.amount) < 0) {
      await base44.asServiceRole.entities.Transfer.update(t.id, {
        amount: 0,
        voided: true,
        void_reason: "Was created from a $0.00 order total — not a real deposit",
      });
      result.voided += 1;
    }
  }

  return result;
}

/**
 * Rebuild the synthetic per-day Etsy deposits from the stored API orders.
 * Derived from the orders themselves (never from an incremental counter) so a
 * partial re-sync can never shrink a day that had more than one receipt.
 */
export async function recomputeDailyDeposits(base44, userId) {
  const orders = await base44.asServiceRole.entities.EtsyOrder.filter({
    owner_user_id: userId,
    source: "etsy_api",
  });
  const dailyNet = {};
  for (const o of orders || []) {
    if (!o.sale_date || o.superseded) continue;
    dailyNet[o.sale_date] = round((dailyNet[o.sale_date] || 0) + num(o.order_net));
  }
  return applyDailyDeposits(base44, userId, dailyNet);
}