/**
 * Profit Calculator - Everbee-style fee calculations
 * Handles Etsy and other marketplace fees with configurable rates
 */

export const DEFAULT_FEE_CONFIG = {
  etsy_listing_fee: 0.20,
  etsy_transaction_fee_percent: 6.5,
  payment_processing_fee_percent: 3.0,
  payment_processing_fee_fixed: 0.25,
  share_save_rate_pct: 4.0,
  advertising_type: "none",
  etsy_ads_rate: 0,
  etsy_ads_rate_type: "percent",
  offsite_ads_rate: 15,
  paypal_fee_percent: 3.49,
  paypal_fee_fixed: 0.49,
  square_fee_percent: 2.9,
  square_fee_fixed: 0.30,
  venmo_business_fee_percent: 1.9,
  venmo_business_fee_fixed: 0.10,
  country: "US",
};

/**
 * Calculate comprehensive profit breakdown
 * @param {Object} input - Calculator inputs
 * @param {number} input.sales_price - Item price
 * @param {number} input.shipping_charged - Shipping charged to customer
 * @param {number} input.discounts - Discounts applied
 * @param {string} input.discounts_type - "percent" or "fixed"
 * @param {number} input.refunds - Refunds issued
 * @param {number} input.sales_tax - Sales tax (excluded from revenue)
 * @param {number} input.cost_of_goods - Materials + packaging cost
 * @param {string} input.advertising_type - "none", "etsy_ads", "etsy_offsite_ads", "social_ads", "google_ads", "influencer_affiliate"
 * @param {number} input.advertising_value - Value for ads (% or $)
 * @param {string} input.advertising_value_type - "percent" or "fixed"
 * @param {boolean} input.share_save_enabled - Enable Share & Save
 * @param {number} input.share_save_discount - Share & Save discount
 * @param {string} input.share_save_discount_type - "percent" or "fixed"
 * @param {number} input.share_save_fee_rate - Share & Save credit rate (default 4%)
 * @param {string} input.payment_method - "etsy" or "paypal" or other
 * @param {Object} feeConfig - Fee configuration (optional, uses defaults if not provided)
 * @returns {Object} Detailed profit breakdown
 */
export function calculateProfit(input, feeConfig = DEFAULT_FEE_CONFIG) {
  const {
    sales_price = 0,
    shipping_charged = 0,
    discounts = 0,
    discounts_type = "fixed",
    refunds = 0,
    sales_tax = 0,
    cost_of_goods = 0,
    shipping_cost = 0,
    overhead_cost = 0,
    labor_cost = 0,
    advertising_type = "none",
    advertising_value = 0,
    advertising_value_type = "percent",
    share_save_enabled = false,
    share_save_discount = 0,
    share_save_discount_type = "percent",
    share_save_fee_rate = 4,
    payment_method = "etsy",
  } = input;

  const config = { ...DEFAULT_FEE_CONFIG, ...feeConfig };

  // Calculate discount amount
  let discount_amount = 0;
  if (discounts_type === "percent") {
    discount_amount = ((sales_price + shipping_charged) * discounts) / 100;
  } else {
    discount_amount = discounts;
  }

  // Calculate Share & Save discount and credit
  let share_save_discount_amount = 0;
  let share_save_fee = 0;
  
  if (share_save_enabled) {
    if (share_save_discount_type === "percent") {
      share_save_discount_amount = (sales_price * share_save_discount) / 100;
    } else {
      share_save_discount_amount = share_save_discount;
    }
    
    // Ensure discount doesn't make price negative
    share_save_discount_amount = Math.min(share_save_discount_amount, sales_price);
    
    // Calculate Share & Save fee credit (4% refund on qualifying total)
    // Qualifying total = (item + shipping - discounts - refunds) exclude tax
    const qualifying_total = sales_price + shipping_charged - discount_amount - refunds;
    share_save_fee = (Math.max(0, qualifying_total) * (config.share_save_rate_pct || share_save_fee_rate)) / 100;
  }

  // Calculate revenue (excludes sales tax, includes Share & Save discount)
  const gross_revenue = sales_price + shipping_charged - discount_amount - share_save_discount_amount - refunds;
  
  // Etsy Listing Fee (flat per listing)
  const listing_fee = config.etsy_listing_fee || 0.20;
  
  // Etsy Transaction Fee (percentage of item price + shipping, before discounts)
  const transaction_base = sales_price + shipping_charged;
  const transaction_fee = (transaction_base * (config.etsy_transaction_fee_percent || 6.5)) / 100;
  
  // Payment Processing Fee (percentage + fixed, applied to total charged to customer)
  const payment_base = gross_revenue + sales_tax; // includes tax for processing
  let processing_fee = 0;
  
  if (payment_method === "paypal") {
    processing_fee = 
      (payment_base * (config.paypal_fee_percent || 3.49)) / 100 + 
      (config.paypal_fee_fixed || 0.49);
  } else if (payment_method === "square") {
    processing_fee = 
      (payment_base * (config.square_fee_percent || 2.9)) / 100 + 
      (config.square_fee_fixed || 0.30);
  } else if (payment_method === "venmo_business") {
    processing_fee = 
      (payment_base * (config.venmo_business_fee_percent || 1.9)) / 100 + 
      (config.venmo_business_fee_fixed || 0.10);
  } else if (payment_method === "zelle" || payment_method === "cash" || payment_method === "venmo_personal") {
    processing_fee = 0;
  } else {
    processing_fee = 
      (payment_base * (config.payment_processing_fee_percent || 3)) / 100 + 
      (config.payment_processing_fee_fixed || 0.25);
  }
  
  // Advertising Costs - all types support % or $ per order
  let advertising_cost = 0;
  if (advertising_type !== "none") {
    if (advertising_value_type === "percent") {
      advertising_cost = (gross_revenue * advertising_value) / 100;
    } else {
      advertising_cost = advertising_value;
    }
  }
  
  // Total Fees (Share & Save credit reduces total fees)
  const total_fees = listing_fee + transaction_fee + processing_fee + advertising_cost - share_save_fee;
  
  // Net revenue after fees
  const net_revenue = gross_revenue - total_fees;
  
  // Total costs
  const total_costs = cost_of_goods + shipping_cost + overhead_cost + labor_cost;
  
  // Profit
  const profit = net_revenue - total_costs;
  
  // Margin (null when no revenue — avoids misleading 0.0% display)
  const profit_margin = gross_revenue > 0 ? (profit / gross_revenue) * 100 : null;
  
  return {
    // Revenue
    gross_revenue,
    sales_tax,
    
    // Fee Breakdown
    listing_fee,
    transaction_fee,
    processing_fee,
    advertising_cost,
    share_save_fee,
    total_fees,
    
    // Share & Save Details
    share_save_discount_amount,
    original_sale_price: sales_price,
    discounted_sale_price: share_save_enabled ? sales_price - share_save_discount_amount : sales_price,
    share_save_credit: share_save_fee, // Alias for backwards compatibility
    
    // Bottom Line
    net_revenue,
    cost_of_goods,
    shipping_cost,
    overhead_cost,
    labor_cost,
    total_costs,
    profit,
    profit_margin,
    
    // Additional metrics
    revenue_after_cogs: net_revenue - cost_of_goods,
    effective_fee_rate: gross_revenue > 0 ? (total_fees / gross_revenue) * 100 : null,
  };
}

/**
 * Calculate fees from order data
 */
export function calculateOrderFees(order, feeConfig) {
  return calculateProfit({
    sales_price: order.gross_total || 0,
    shipping_charged: order.shipping_charged || 0,
    discounts: order.discounts || 0,
    refunds: order.refunds || 0,
    sales_tax: order.sales_tax || 0,
    cost_of_goods: 0, // Not included in order
  }, feeConfig);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount, showSign = false) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  
  if (showSign && amount < 0) {
    return `-${formatted}`;
  }
  
  return formatted;
}

/**
 * Format percentage for display
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate break-even price
 * Find the minimum price needed to achieve target profit
 */
export function calculateBreakEven(costOfGoods, targetProfit = 0, feeConfig = DEFAULT_FEE_CONFIG) {
  // This requires solving the fee equation iteratively
  // Since fees depend on price, we need to find price where:
  // price - fees(price) - cogs = targetProfit
  
  let price = costOfGoods + targetProfit;
  let iterations = 0;
  const maxIterations = 10;
  
  while (iterations < maxIterations) {
    const result = calculateProfit({
      sales_price: price,
      shipping_charged: 0,
      discounts: 0,
      refunds: 0,
      sales_tax: 0,
      cost_of_goods: costOfGoods,
    }, feeConfig);
    
    const diff = result.profit - targetProfit;
    
    if (Math.abs(diff) < 0.01) {
      return price;
    }
    
    // Adjust price
    price += diff;
    iterations++;
  }
  
  return price;
}