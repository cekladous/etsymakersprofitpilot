/**
 * Square → Profit Pilot payment sync.
 *
 * Every COMPLETED Square payment is counted exactly once:
 *   1. It is first matched against the seller's Etsy orders (Etsy in-person sales
 *      are processed through Square, so those already exist as Etsy revenue).
 *   2. If matched, revenue stays on the Etsy order and only the difference Square
 *      collected above the Etsy total is recorded as a "Square adjustment" sale.
 *   3. If not matched, one CustomSale is created for the payment.
 *
 * Upsert keys: CustomSale.square_payment_id, BusinessExpense.square_payment_id,
 * EtsyOrder.square_payment_id — so replays never duplicate anything.
 */
import { squareFetch } from "./squareOauth.ts";

export const MATCH_AMOUNT_TOLERANCE = 5;
export const MATCH_DATE_WINDOW_DAYS = 2;
export const SQUARE_FEE_CATEGORY = "payment_processing_fees";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

export const toDateOnly = (iso) => (iso ? String(iso).slice(0, 10) : "");

export const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dayDiff = (a, b) => {
  if (!a || !b) return Infinity;
  return Math.abs(new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000;
};

export const customerName = (customer) => {
  if (!customer) return "";
  const person = [customer.given_name, customer.family_name].filter(Boolean).join(" ").trim();
  return person || customer.company_name || "";
};

export const paymentAmount = (payment) => {
  const total = payment?.total_money?.amount || 0;
  const refunded = payment?.refunded_money?.amount || 0;
  return round2((total - refunded) / 100);
};

const paymentTax = (payment) => round2((payment?.total_tax_money?.amount || 0) / 100);

const paymentFee = (payment) => {
  const fees = Array.isArray(payment?.processing_fee) ? payment.processing_fee : [];
  return round2(fees.reduce((sum, f) => sum + toNumber(f?.amount_money?.amount), 0) / 100);
};

export const paymentMethod = (payment) => {
  const source = String(payment?.source_type || "").toUpperCase();
  if (source === "CASH") return "cash";
  if (source === "EXTERNAL") return "external";
  if (source === "CARD") return "card";
  return source ? source.toLowerCase() : "other";
};

const orderLineItemNames = (order) =>
  (Array.isArray(order?.line_items) ? order.line_items : [])
    .map((li) => String(li?.name || "").trim())
    .filter(Boolean);

export const orderTotalOf = (order) => {
  if (!order) return 0;
  if (order.order_total != null && order.order_total !== "") return toNumber(order.order_total);
  if (order.adjusted_order_total != null && order.adjusted_order_total !== "") return toNumber(order.adjusted_order_total);
  return round2(toNumber(order.order_value) + toNumber(order.shipping_charged) + toNumber(order.sales_tax) - toNumber(order.discount_amount));
};

/** All payments in a date range, following Square pagination cursors. */
export async function listSquarePayments(token, beginDate, endDate) {
  const out = [];
  let cursor = "";
  const begin = `${beginDate}T00:00:00Z`;
  const end = `${endDate}T23:59:59Z`;
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ begin_time: begin, end_time: end, limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const body = await squareFetch(token, `/v2/payments?${qs.toString()}`);
    const batch = body?.payments || [];
    out.push(...batch);
    cursor = body?.cursor || "";
    if (!cursor || batch.length === 0) break;
  }
  return out;
}

async function ordersByIds(token, orderIds) {
  const map = {};
  if (!orderIds.length) return map;
  for (let i = 0; i < orderIds.length; i += 100) {
    const chunk = orderIds.slice(i, i + 100);
    const body = await squareFetch(token, "/v2/orders/batch-retrieve", {
      method: "POST",
      body: JSON.stringify({ order_ids: chunk }),
    });
    (body?.orders || []).forEach((order) => { map[order.id] = order; });
  }
  return map;
}

async function customersByIds(token, customerIds) {
  const map = {};
  if (!customerIds.length) return map;
  for (let i = 0; i < customerIds.length; i += 100) {
    const chunk = customerIds.slice(i, i + 100);
    const body = await squareFetch(token, "/v2/customers/bulk-retrieve", {
      method: "POST",
      body: JSON.stringify({ customer_ids: chunk }),
    });
    (body?.responses || []).forEach((r) => { if (r?.customer) map[r.customer.id] = r.customer; });
  }
  return map;
}

/** Map Square order id → invoice number (best effort: invoices are enrichment only). */
async function invoiceNumbersByOrder(token) {
  const map = {};
  try {
    const locations = await squareFetch(token, "/v2/locations");
    for (const location of locations?.locations || []) {
      let cursor = "";
      for (let page = 0; page < 10; page++) {
        const body = await squareFetch(
          token,
          `/v2/invoices?location_id=${location.id}&limit=100${cursor ? `&cursor=${cursor}` : ""}`,
        );
        (body?.invoices || []).forEach((invoice) => {
          if (invoice.order_id) map[invoice.order_id] = invoice.invoice_number || "";
        });
        cursor = body?.cursor || "";
        if (!cursor) break;
      }
    }
  } catch {
    // invoices are optional context — never fail the sync over them
  }
  return map;
}

/**
 * Pick the Etsy order that a Square payment represents.
 * Amount within $5, date within 2 days; buyer name/email breaks ties.
 * Etsy "IPP Anonymous Buyer" (in-person) orders match on amount + date.
 */
export function findEtsyMatch({ date, amount, buyerName, email, orders }) {
  const wanted = normalizeName(buyerName);
  const wantedToken = wanted.split(" ").filter((token) => token.length > 2)[0] || "";
  const emailToken = normalizeName(String(email || "").split("@")[0]);
  const candidates = [];

  for (const order of orders) {
    if (!order || order.square_payment_id) continue;
    if (!order.sale_date) continue;
    const dateDiff = dayDiff(order.sale_date, date);
    if (dateDiff > MATCH_DATE_WINDOW_DAYS) continue;
    const total = orderTotalOf(order);
    if (!total) continue;
    const amountDiff = Math.abs(total - amount);
    if (amountDiff > MATCH_AMOUNT_TOLERANCE) continue;

    const names = [order.buyer_full_name, order.buyer_username, `${order.first_name || ""} ${order.last_name || ""}`]
      .map(normalizeName)
      .filter(Boolean);
    const anonymous = names.some((n) => n.includes("ipp") || n.includes("anonymous"));

    let nameScore = 3;
    if (anonymous) nameScore = 2;
    if (wanted && names.some((n) => n === wanted || (wantedToken && n.includes(wantedToken)))) nameScore = 0;
    if (!nameScore && emailToken && names.some((n) => n.includes(emailToken))) nameScore = -1;

    candidates.push({ order, nameScore, amountDiff, dateDiff });
  }

  candidates.sort((a, b) => (a.nameScore - b.nameScore) || (a.amountDiff - b.amountDiff) || (a.dateDiff - b.dateDiff));
  return candidates.length ? candidates[0].order : null;
}

function squareSaleDescription(invoiceNo, lineItems) {
  const label = invoiceNo ? `Square Invoice #${invoiceNo}` : "Square sale";
  const firstItem = lineItems[0] ? ` — ${lineItems[0].slice(0, 70)}` : "";
  return `${label}${firstItem}`;
}

function squareSaleNotes(payment, invoiceNo, lineItems) {
  const parts = [`Square payment ${payment.id}`];
  if (payment.order_id) parts.push(`Square order ${payment.order_id}`);
  if (invoiceNo) parts.push(`Invoice #${invoiceNo}`);
  const method = paymentMethod(payment);
  if (method) parts.push(`Method: ${method}`);
  if (lineItems.length) parts.push(`Items: ${lineItems.join(" | ")}`);
  return parts.join(" | ");
}

function feeDescription(payment, invoiceNo) {
  const label = invoiceNo ? `Square Invoice #${invoiceNo}` : `payment ${String(payment.id).slice(0, 8)}`;
  return `Square processing fee — ${label}`;
}

function adjustmentPayload({ ownerUserId, payment, amount, order, invoiceNo, buyerName, date }) {
  const orderTotal = orderTotalOf(order);
  const adjustment = round2(Math.max(0, amount - orderTotal));
  return {
    payload: {
      owner_user_id: ownerUserId,
      date,
      vendor: buyerName || order.buyer_full_name || "Square Customer",
      description: `Square adjustment — Etsy order #${order.order_id}`,
      payment_source: "Square",
      pre_tax_amount: adjustment,
      sales_tax_collected: 0,
      gross_sale: adjustment,
      shipping_or_postage_cost: 0,
      notes: [
        `Square collected ${amount.toFixed(2)} vs Etsy total ${orderTotal.toFixed(2)} on order #${order.order_id}.`,
        invoiceNo ? `Invoice #${invoiceNo}.` : "",
        `Square payment ${payment.id}`,
      ].filter(Boolean).join(" "),
      square_payment_id: `${payment.id}#adj`,
      square_order_id: payment.order_id || "",
      square_invoice_number: invoiceNo || "",
      square_payment_method: paymentMethod(payment),
      linked_etsy_order_id: order.order_id || "",
      is_square_adjustment: true,
    },
    adjustment,
  };
}

function customSalePayload({ ownerUserId, payment, amount, invoiceNo, buyerName, date, lineItems }) {
  const tax = Math.min(amount, paymentTax(payment));
  return {
    owner_user_id: ownerUserId,
    date,
    vendor: buyerName || "Square Customer",
    description: squareSaleDescription(invoiceNo, lineItems),
    payment_source: "Square",
    pre_tax_amount: round2(amount - tax),
    sales_tax_collected: tax,
    gross_sale: amount,
    shipping_or_postage_cost: 0,
    notes: squareSaleNotes(payment, invoiceNo, lineItems),
    square_payment_id: payment.id,
    square_order_id: payment.order_id || "",
    square_invoice_number: invoiceNo || "",
    square_payment_method: paymentMethod(payment),
    linked_etsy_order_id: "",
    is_square_adjustment: false,
  };
}

/** Create or update the Square fee expense for one payment. */
async function upsertPaymentFee(base44, { ownerUserId, payment, invoiceNo, date, existing }) {
  const amount = paymentFee(payment);
  const base = {
    date,
    category_group: "business_expenses",
    category_name: SQUARE_FEE_CATEGORY,
    amount,
    vendor: "Square",
    description: feeDescription(payment, invoiceNo),
    payment_source: "Square",
    notes: `Square payment ${payment.id}${invoiceNo ? ` (Invoice #${invoiceNo})` : ""}`,
    square_payment_id: payment.id,
  };

  if (existing) {
    if (round2(existing.amount) !== amount || existing.date !== date || existing.description !== base.description) {
      await base44.asServiceRole.entities.BusinessExpense.update(existing.id, base);
      return { created: false, amount };
    }
    return { created: false, amount };
  }
  if (amount <= 0) return { created: false, amount: 0 };

  await base44.asServiceRole.entities.BusinessExpense.create({ ...base, owner_user_id: ownerUserId });
  return { created: true, amount };
}

export async function deleteAdjustmentFor(base44, ownerUserId, paymentId) {
  const rows = await base44.asServiceRole.entities.CustomSale.filter({
    owner_user_id: ownerUserId,
    square_payment_id: `${paymentId}#adj`,
  });
  for (const row of rows || []) {
    await base44.asServiceRole.entities.CustomSale.delete(row.id);
  }
}

export async function deletePaymentSale(base44, ownerUserId, paymentId) {
  const rows = await base44.asServiceRole.entities.CustomSale.filter({
    owner_user_id: ownerUserId,
    square_payment_id: paymentId,
  });
  for (const row of rows || []) {
    await base44.asServiceRole.entities.CustomSale.delete(row.id);
  }
}

async function upsertAdjustment(base44, { ownerUserId, payment, amount, order, invoiceNo, buyerName, date, existing }) {
  const { payload, adjustment } = adjustmentPayload({ ownerUserId, payment, amount, order, invoiceNo, buyerName, date });
  if (adjustment <= 0) {
    if (existing) await base44.asServiceRole.entities.CustomSale.delete(existing.id);
    return { created: false, adjustment: 0 };
  }
  if (existing) {
    if (round2(existing.gross_sale) !== adjustment || existing.date !== date) {
      await base44.asServiceRole.entities.CustomSale.update(existing.id, payload);
    }
    return { created: false, adjustment };
  }
  await base44.asServiceRole.entities.CustomSale.create(payload);
  return { created: true, adjustment };
}

/**
 * Sync Square payments for one seller.
 * Returns counters used by the backfill report and the Settings card.
 */
export async function syncSquarePayments(base44, { ownerUserId, conn, beginDate, endDate }) {
  const stats = {
    owner_user_id: ownerUserId,
    payments_scanned: 0,
    linked_to_etsy: 0,
    new_custom_sales: 0,
    updated_custom_sales: 0,
    adjustments_created: 0,
    adjustments_total: 0,
    fees_recorded: 0,
    fees_total: 0,
    errors: [],
  };

  const token = conn.access_token;
  const payments = (await listSquarePayments(token, beginDate, endDate))
    .filter((payment) => payment.status === "COMPLETED");
  stats.payments_scanned = payments.length;
  if (payments.length === 0) return stats;

  const orderIds = [...new Set(payments.map((p) => p.order_id).filter(Boolean))];
  const customerIds = [...new Set(payments.map((p) => p.customer_id).filter(Boolean))];
  const [squareOrders, squareCustomers, invoiceByOrder] = await Promise.all([
    ordersByIds(token, orderIds).catch(() => ({})),
    customersByIds(token, customerIds).catch(() => ({})),
    invoiceNumbersByOrder(token),
  ]);

  const [etsyOrders, customSales, businessExpenses] = await Promise.all([
    base44.asServiceRole.entities.EtsyOrder.filter({ owner_user_id: ownerUserId }),
    base44.asServiceRole.entities.CustomSale.filter({ owner_user_id: ownerUserId }),
    base44.asServiceRole.entities.BusinessExpense.filter({ owner_user_id: ownerUserId }),
  ]);

  const salesByKey = new Map();
  (customSales || []).forEach((sale) => {
    if (sale.square_payment_id) salesByKey.set(sale.square_payment_id, sale);
  });
  const feeByPayment = new Map();
  (businessExpenses || []).forEach((expense) => {
    if (expense.square_payment_id) feeByPayment.set(expense.square_payment_id, expense);
  });

  const matchableOrders = (etsyOrders || []).filter((order) => !order.superseded);

  for (const payment of payments) {
    try {
      const amount = paymentAmount(payment);
      const date = toDateOnly(payment.created_at);
      const squareOrder = squareOrders[payment.order_id] || null;
      const customer = squareCustomers[payment.customer_id] || null;
      const invoiceNo = invoiceByOrder[payment.order_id] || "";
      const lineItems = orderLineItemNames(squareOrder);
      const buyerName = customerName(customer);

      const fee = await upsertPaymentFee(base44, {
        ownerUserId,
        payment,
        invoiceNo,
        date,
        existing: feeByPayment.get(payment.id) || null,
      });
      if (fee.created) stats.fees_recorded += 1;
      if (fee.amount > 0) stats.fees_total = round2(stats.fees_total + fee.amount);

      const existingSale = salesByKey.get(payment.id) || null;
      const existingAdj = salesByKey.get(`${payment.id}#adj`) || null;

      let linkedOrder = matchableOrders.find((order) => order.square_payment_id === payment.id) || null;
      if (!linkedOrder) {
        linkedOrder = findEtsyMatch({
          date,
          amount,
          buyerName,
          email: customer?.email_address || "",
          orders: matchableOrders,
        });
        if (linkedOrder) {
          const linkUpdate = {
            square_payment_id: payment.id,
            square_payment_amount: amount,
            square_link_type: "auto",
            square_linked_at: new Date().toISOString(),
          };
          await base44.asServiceRole.entities.EtsyOrder.update(linkedOrder.id, linkUpdate);
          Object.assign(linkedOrder, linkUpdate);
          stats.linked_to_etsy += 1;
        }
      }

      if (linkedOrder) {
        const { created, adjustment } = await upsertAdjustment(base44, {
          ownerUserId,
          payment,
          amount,
          order: linkedOrder,
          invoiceNo,
          buyerName,
          date,
          existing: existingAdj,
        });
        if (created) stats.adjustments_created += 1;
        if (adjustment > 0) stats.adjustments_total = round2(stats.adjustments_total + adjustment);

        if (round2(linkedOrder.square_adjustment_amount) !== adjustment) {
          await base44.asServiceRole.entities.EtsyOrder.update(linkedOrder.id, { square_adjustment_amount: adjustment });
          linkedOrder.square_adjustment_amount = adjustment;
        }

        // The Etsy order already carries this revenue — drop any full Square sale for it.
        if (existingSale) {
          await base44.asServiceRole.entities.CustomSale.delete(existingSale.id);
          salesByKey.delete(payment.id);
        }
        continue;
      }

      // Not linked: this payment is its own revenue.
      if (existingAdj) {
        await base44.asServiceRole.entities.CustomSale.delete(existingAdj.id);
        salesByKey.delete(`${payment.id}#adj`);
      }

      const payload = customSalePayload({ ownerUserId, payment, amount, invoiceNo, buyerName, date, lineItems });

      if (existingSale) {
        if (round2(existingSale.gross_sale) !== amount || existingSale.date !== date) {
          await base44.asServiceRole.entities.CustomSale.update(existingSale.id, payload);
          stats.updated_custom_sales += 1;
        }
        continue;
      }

      if (amount <= 0) continue;
      const created = await base44.asServiceRole.entities.CustomSale.create(payload);
      salesByKey.set(payment.id, created);
      stats.new_custom_sales += 1;
    } catch (error) {
      stats.errors.push(`${payment.id}: ${error.message}`);
    }
  }

  return stats;
}

/** Fetch one payment (with its order/customer/invoice context) and apply it to an Etsy order. */
export async function linkSquarePaymentToOrder(base44, { ownerUserId, orderId, conn, paymentId }) {
  const orders = await base44.asServiceRole.entities.EtsyOrder.filter({ id: orderId, owner_user_id: ownerUserId });
  const order = orders?.[0];
  if (!order) throw new Error("Order not found");

  const body = await squareFetch(conn.access_token, `/v2/payments/${paymentId}`);
  const payment = body?.payment;
  if (!payment) throw new Error("Square payment not found");
  if (payment.status !== "COMPLETED") throw new Error("That Square payment is not completed");

  // A payment can only represent one order.
  const holders = await base44.asServiceRole.entities.EtsyOrder.filter({ owner_user_id: ownerUserId, square_payment_id: paymentId });
  for (const holder of holders || []) {
    if (holder.id === order.id) continue;
    await base44.asServiceRole.entities.EtsyOrder.update(holder.id, {
      square_payment_id: "",
      square_payment_amount: 0,
      square_adjustment_amount: 0,
      square_link_type: "",
    });
  }

  await deletePaymentSale(base44, ownerUserId, paymentId);

  const amount = paymentAmount(payment);
  const linkUpdate = {
    square_payment_id: paymentId,
    square_payment_amount: amount,
    square_link_type: "manual",
    square_linked_at: new Date().toISOString(),
  };
  await base44.asServiceRole.entities.EtsyOrder.update(order.id, linkUpdate);
  Object.assign(order, linkUpdate);

  const customer = payment.customer_id
    ? await customersByIds(conn.access_token, [payment.customer_id]).then((map) => map[payment.customer_id]).catch(() => null)
    : null;
  const invoiceMap = await invoiceNumbersByOrder(conn.access_token);
  const invoiceNo = invoiceMap[payment.order_id] || "";

  const existingAdj = (await base44.asServiceRole.entities.CustomSale.filter({
    owner_user_id: ownerUserId,
    square_payment_id: `${paymentId}#adj`,
  }))[0] || null;

  const { adjustment } = await upsertAdjustment(base44, {
    ownerUserId,
    payment,
    amount,
    order,
    invoiceNo,
    buyerName: customerName(customer),
    date: toDateOnly(payment.created_at),
    existing: existingAdj,
  });

  await base44.asServiceRole.entities.EtsyOrder.update(order.id, { square_adjustment_amount: adjustment });

  return { order_id: order.order_id, square_amount: amount, adjustment };
}

/** Remove a manual link and put the Square payment back as its own revenue row. */
export async function unlinkSquarePaymentFromOrder(base44, { ownerUserId, orderId, conn }) {
  const orders = await base44.asServiceRole.entities.EtsyOrder.filter({ id: orderId, owner_user_id: ownerUserId });
  const order = orders?.[0];
  if (!order) throw new Error("Order not found");

  const paymentId = order.square_payment_id;
  if (!paymentId) return { unlinked: false, order_id: order.order_id };

  await base44.asServiceRole.entities.EtsyOrder.update(order.id, {
    square_payment_id: "",
    square_payment_amount: 0,
    square_adjustment_amount: 0,
    square_link_type: "",
    square_linked_at: null,
  });
  await deleteAdjustmentFor(base44, ownerUserId, paymentId);

  // Re-create the payment's own revenue row so it is still counted exactly once.
  let recreated = false;
  try {
    const body = await squareFetch(conn.access_token, `/v2/payments/${paymentId}`);
    const payment = body?.payment;
    if (payment && payment.status === "COMPLETED") {
      const invoiceMap = await invoiceNumbersByOrder(conn.access_token);
      const squareOrder = payment.order_id
        ? (await ordersByIds(conn.access_token, [payment.order_id]).catch(() => ({})))[payment.order_id] || null
        : null;
      const customer = payment.customer_id
        ? (await customersByIds(conn.access_token, [payment.customer_id]).catch(() => ({})))[payment.customer_id] || null
        : null;
      await deletePaymentSale(base44, ownerUserId, paymentId);
      if (paymentAmount(payment) > 0) {
        await base44.asServiceRole.entities.CustomSale.create(customSalePayload({
          ownerUserId,
          payment,
          amount: paymentAmount(payment),
          invoiceNo: invoiceMap[payment.order_id] || "",
          buyerName: customerName(customer),
          date: toDateOnly(payment.created_at),
          lineItems: orderLineItemNames(squareOrder),
        }));
        recreated = true;
      }
    }
  } catch {
    // the link is already cleared; revenue re-creation is best effort
  }

  return { unlinked: true, order_id: order.order_id, recreated };
}