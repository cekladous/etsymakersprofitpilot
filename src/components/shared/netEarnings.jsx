/**
 * SINGLE SOURCE OF TRUTH for per-order net earnings calculation.
 *
 * Matches Etsy's own per-order "You earned" breakdown exactly:
 *   Net Earnings = revenueExclTax - transaction_fees - processing_fees + share_save_credit
 *
 * Shop-level costs (Listing fees, Etsy Ads, Offsite Ads, shipping labels, etc.)
 * are NOT attributed to individual orders — they appear only in the shop-wide
 * statement totals via aggregateFinancials.
 *
 * When no statement has been imported yet we estimate using:
 *   - Etsy's standard 6.5% transaction fee on the pre-tax revenue
 *   - order.card_processing_fees stored from the sold-orders CSV
 * Sales tax is NEVER part of net earnings.
 */

const ETSY_TRANSACTION_RATE = 0.065;

/**
 * Find the best OrderFee record for an order.
 * If multiple records exist, prefer the one with Share & Save credit populated.
 */
export function findOrderFee(orderFees, orderId) {
  if (!orderFees || !orderId) return null;
  const matches = orderFees.filter(f => f.order_id === orderId);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  // Prefer the record that has a Share & Save credit populated
  const withShareSave = matches.find(f => (f.share_save_credit || 0) > 0);
  return withShareSave || matches[0];
}

/**
 * Per-order fees as shown in Etsy's "You earned" breakdown.
 * Only includes order-specific fees: transaction + processing - share_save_credit.
 * Shop-level costs (listing, ads, shipping labels) are excluded — they appear
 * only in the shop-wide statement totals.
 */
export function perOrderFees(orderFees) {
  if (!orderFees) return 0;
  return (orderFees.transaction_fees || 0) +
    (orderFees.processing_fees || 0) -
    (orderFees.share_save_credit || 0);
}

export function calculateNetEarnings(order, orderFees) {
  if (!order) return 0;

  const revenueExclTax =
    (order.order_value || 0) +
    (order.shipping_charged || 0) -
    (order.discount_amount || 0);

  if (orderFees) {
    // Only per-order fees: transaction + processing - share_save_credit
    // Listing fees, Etsy Ads, Offsite Ads, shipping labels, etc. are
    // shop-level costs — they are NOT attributed to individual orders
    // (matches Etsy's own per-order "You earned" breakdown).
    return revenueExclTax - perOrderFees(orderFees);
  }

  // Fallback estimate. order.order_net is NOT used here - it omits
  // processing fees and Share and Save credits.
  const estimatedTransactionFee = Math.round(revenueExclTax * ETSY_TRANSACTION_RATE * 100) / 100;
  const processingFee = order.card_processing_fees || 0;
  return revenueExclTax - estimatedTransactionFee - processingFee;
}

export function calculateTotalNetEarnings(orders, orderFees) {
  if (!Array.isArray(orders)) return 0;
  return orders.reduce((sum, o) => sum + calculateNetEarnings(o, findOrderFee(orderFees, o.order_id)), 0);
}