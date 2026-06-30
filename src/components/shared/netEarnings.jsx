/**
 * SINGLE SOURCE OF TRUTH for per-order net earnings calculation.
 *
 * When an Etsy statement has been imported the OrderFee entity record for the
 * order contains the exact transaction_fees, processing_fees and share_save_credit
 * values from Etsy and the formula is exact.
 *
 * When no statement has been imported yet we estimate using:
 *   - Etsy's standard 6.5% transaction fee on the pre-tax revenue
 *   - order.card_processing_fees stored from the sold-orders CSV
 * Sales tax is NEVER part of net earnings.
 */

const ETSY_TRANSACTION_RATE = 0.065;

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

  // Fallback estimate. order.order_net is NOT used here - it omits
  // processing fees and Share and Save credits.
  const estimatedTransactionFee = Math.round(revenueExclTax * ETSY_TRANSACTION_RATE * 100) / 100;
  const processingFee = order.card_processing_fees || 0;
  return revenueExclTax - estimatedTransactionFee - processingFee;
}

export function calculateTotalNetEarnings(orders, orderFees) {
  if (!Array.isArray(orders)) return 0;
  const feeMap = {};
  (orderFees || []).forEach(f => {
    if (f.order_id) feeMap[f.order_id] = f;
  });
  return orders.reduce((sum, o) => sum + calculateNetEarnings(o, feeMap[o.order_id]), 0);
}