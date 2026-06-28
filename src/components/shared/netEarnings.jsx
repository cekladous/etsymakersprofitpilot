/**
 * SINGLE SOURCE OF TRUTH for per-order net earnings calculation.
 * Formula: Net = (order_value + shipping_charged - discount_amount)
 *          - transaction_fees - processing_fees + share_save_credit
 * Sales tax is NOT part of net earnings (collected for the buyer, remitted by Etsy).
 *
 * Fallback priority when OrderFee entity record is not available:
 *   1. order.order_net  — Etsy's pre-calculated "Order Net" from their CSV export
 *   2. revenueExclTax - order.card_processing_fees  — partial estimate
 */
export function calculateNetEarnings(order, orderFees) {
  if (!order) return 0;

  const revenueExclTax =
    (order.order_value || 0) +
    (order.shipping_charged || 0) -
    (order.discount_amount || 0);

  if (orderFees) {
    return (
      revenueExclTax -
      (orderFees.transaction_fees || 0) -
      (orderFees.processing_fees || 0) +
      (orderFees.share_save_credit || 0)
    );
  }

  // No OrderFee record available — use Etsy's pre-calculated value if present
  if (order.order_net > 0) return order.order_net;

  // Last resort: subtract known card processing fee from revenue
  return revenueExclTax - (order.card_processing_fees || 0);
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
