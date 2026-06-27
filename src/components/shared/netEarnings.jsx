/**
 * SINGLE SOURCE OF TRUTH for per-order net earnings calculation.
 * Formula: Net = (order_value + shipping_charged - discount_amount)
 *               - transaction_fees - processing_fees + share_save_credit
 * Sales tax is NOT part of net earnings (collected for the buyer, remitted by Etsy).
 */
export function calculateNetEarnings(order, orderFees) {
  if (!order) return 0;
  const revenueExclTax =
    (order.order_value || 0) +
    (order.shipping_charged || 0) -
    (order.discount_amount || 0);

  if (!orderFees) return revenueExclTax;

  return (
    revenueExclTax -
    (orderFees.transaction_fees || 0) -
    (orderFees.processing_fees || 0) +
    (orderFees.share_save_credit || 0)
  );
}

/**
 * Aggregate net earnings across a list of orders.
 * @param {Array} orders - EtsyOrder records
 * @param {Array} orderFees - OrderFee records (matched by order_id)
 */
export function calculateTotalNetEarnings(orders, orderFees) {
  if (!Array.isArray(orders)) return 0;
  const feeMap = {};
  (orderFees || []).forEach(f => {
    if (f.order_id) feeMap[f.order_id] = f;
  });
  return orders.reduce((sum, o) => sum + calculateNetEarnings(o, feeMap[o.order_id]), 0);
}