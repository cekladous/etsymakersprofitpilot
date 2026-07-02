/**
 * SINGLE SOURCE OF TRUTH for per-order net earnings calculation.
 *
 * When an Etsy statement has been imported the OrderFee entity record for the
 * order contains the exact transaction_fees, processing_fees, listing_fees,
 * share_save_credit, ads, shipping, and other fees from Etsy.
 * total_fees already has Share & Save subtracted (it's a credit).
 *
 * Net Earnings = revenueExclTax - total_fees
 *   where total_fees = listing + transaction + processing - share_save + ads + shipping + other
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

export function calculateNetEarnings(order, orderFees) {
  if (!order) return 0;

  const revenueExclTax =
    (order.order_value || 0) +
    (order.shipping_charged || 0) -
    (order.discount_amount || 0);

  if (orderFees) {
    // total_fees already includes all fee types with Share & Save subtracted
    return revenueExclTax - (orderFees.total_fees || 0);
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