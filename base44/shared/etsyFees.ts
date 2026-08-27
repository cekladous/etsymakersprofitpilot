// Estimate per-order Etsy fees from a seller's configured Settings rates.
// Mirrors the client-side profitCalculator (etsy payment method) so API-imported
// orders get the same OrderFee shape as manually imported ones.
function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function estimateOrderFees(order, s) {
  const listingFee = Number(s.etsy_listing_fee ?? 0.20);
  const txnPct = Number(s.etsy_transaction_fee_percent ?? 6.5);
  const procPct = Number(s.payment_processing_fee_percent ?? 3.0);
  const procFixed = Number(s.payment_processing_fee_fixed ?? 0.25);
  const shareSavePct = Number(s.share_save_rate_pct ?? 0);
  const adType = s.advertising_type || "none";
  const offsiteRate = Number(s.offsite_ads_rate ?? 15);
  const etsyAdsRate = Number(s.etsy_ads_rate ?? 0);

  const itemTotal = Number(order.order_value) || 0;
  const shipping = Number(order.shipping_charged) || 0;
  const discount = Number(order.discount_amount) || 0;
  const refund = Number(order.refund_amount) || 0;
  const tax = Number(order.sales_tax) || 0;
  const itemCount = Number(order.number_of_items) || 1;

  const grossRevenue = Math.max(0, itemTotal + shipping - discount - refund);
  const listing = listingFee * itemCount;
  const transaction = (itemTotal + shipping) * txnPct / 100;
  const processingBase = grossRevenue + tax;
  const processing = processingBase * procPct / 100 + procFixed;

  // Share & Save credit (only when the seller has a configured rate)
  const shareSaveCredit = shareSavePct > 0 ? (grossRevenue * shareSavePct / 100) : 0;

  let etsyAds = 0;
  let offsiteAds = 0;
  if (adType === "etsy_ads") {
    etsyAds = etsyAdsRate > 0 ? (grossRevenue * etsyAdsRate / 100) : 0;
  } else if (adType === "offsite_ads") {
    offsiteAds = (grossRevenue * offsiteRate) / 100;
  }

  const totalFees = Math.max(0, listing + transaction + processing + etsyAds + offsiteAds - shareSaveCredit);

  return {
    listing_fees: round(listing),
    transaction_fees: round(transaction),
    processing_fees: round(processing),
    share_save_credit: -round(shareSaveCredit),
    etsy_ads: round(etsyAds),
    offsite_ads_fees: round(offsiteAds),
    other_fees: 0,
    etsy_shipping: 0,
    other_postage_costs: 0,
    total_fees: round(totalFees),
  };
}