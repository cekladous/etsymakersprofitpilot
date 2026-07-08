/**
 * Channel detection utilities for Etsy orders.
 *
 * Orders can come from different sources/channels:
 * - Online Etsy checkout (order_type: "online", payment_type: "online_cc")
 * - In-person Square sale (order_type: "inperson_square_card", payment_type: "square_card")
 *
 * The order_type and payment_type fields are populated by:
 * - Sold Orders Report import (more specific, e.g. "inperson_square_card")
 * - Payment Account CSV import (generic, e.g. "online")
 */

// Square processing fee rates (2026 US, from Settings defaults)
export const SQUARE_FEE_PERCENT = 0.029;
export const SQUARE_FEE_FIXED = 0.30;

/**
 * Detect whether an order was processed as an in-person Square sale.
 * Checks both order_type and payment_type for Square/inperson indicators.
 */
export function isSquareInPersonOrder(order) {
  if (!order) return false;
  const orderType = String(order.order_type || '').toLowerCase();
  const paymentType = String(order.payment_type || '').toLowerCase();
  return orderType.includes('inperson') ||
         orderType.includes('square') ||
         paymentType.includes('square') ||
         paymentType.includes('inperson');
}

/**
 * Get a human-readable channel label for display.
 * Returns null for standard online orders (no badge needed).
 */
export function getChannelLabel(order) {
  if (!order) return null;

  if (isSquareInPersonOrder(order)) {
    return { label: 'In-Person (Square)', variant: 'square' };
  }

  // Online orders don't get a badge — they're the default
  return null;
}