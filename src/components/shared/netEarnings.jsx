/**
 * SINGLE SOURCE OF TRUTH for per-order net earnings calculation.
 *
 * When an Etsy statement has been imported the OrderFee entity record for the
 * order contains the exact transaction_fees, processing_fees and share_save_credit
 * values from Etsy and the formula is exact.
 *
 * When no statement has been imported yet we estimate using:
 *   – Etsy's standard 6.5% transaction fee on the pre-tax revenue
 *   – order.card_processing_fees stored from the sold-orders CSV
 * (Share & Save credit cannot be estimated without statement data.)
 *
 * Sales tax is NEVER part of net earnings — it is collected for the buyer
 * and remitted directly by Etsy to the tax authority.
 */

// Etsy's standard transaction fee rate (as of 2023-present)
const ETSY_TRANSACTION_RATE = 0.065;

export function calculateNetEarnings(order, orderFees) {
  if (!order) return 0;

  const revenueExclTax =
    (order.order_value || 0) +
    (order.shipping_charged || 0) -
    (order.discount_amount || 0);

  if (orderFees) {
    // Exact calculation using statement-imported fee data
    return (
      revenueExclTax -
      (orderFees.transaction_fees || 0) -
      (orderFees.processing_fees || 0) +
      (orderFees.share_save_credit || 0)
    );
  }

  // If the order was imported from an Etsy statement and has the exact net payout
  // recorded (order_net), use it — handles cases where OrderFee couldn't be matched
  if (order.order_net && order.source === 'etsy_statement') {
    return order.order_net;
  }

  // Fallback estimate when no statement has been imported:
  // Use Etsy's standard 6.5% transaction fee + stored card processing fee.
  // Share & Save credit is omitted (unknown without statement data).
  const estimatedTransactionFee = Math.round(revenueExclTax * ETSY_TRANSACTION_RATE * 100) / 100;
  const processingFee = order.card_processing_fees || 0;
  return revenueExclTax - estimatedTransactionFee - processingFee;
}

/**
 * Aggregate net earnings across a list of orders.
 * @param {Array} orders     - EtsyOrder records
 * @param {Array} orderFees  - OrderFee records (matched by order_id)
 */
export function calculateTotalNetEarnings(orders, orderFees) {
  if (!Array.isArray(orders)) return 0;
  const feeMap = {};
  (orderFees || []).forEach(f => {
    if (f.order_id) feeMap[f.order_id] = f;
  });
  return orders.reduce((sum, o) => sum + calculateNetEarnings(o, feeMap[o.order_id]), 0);
}
