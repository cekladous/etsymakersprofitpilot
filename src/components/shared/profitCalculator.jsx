/**
 * Profit Calculator - Everbee-style fee calculations
 * Handles Etsy and other marketplace fees with configurable rates
 */

export const DEFAULT_FEE_CONFIG = {
  etsy_listing_fee: 0.20,
  etsy_transaction_fee_percent: 6.5,
  payment_processing_fee_percent: 3.0,
  payment_processing_fee_fixed: 0.25,
  country: "US",
};

/**
 * Calculate comprehensive profit breakdown
 * @param {Object} input - Calculator inputs
 * @param {number} input.sales_price - Item price
 * @param {number} input.shipping_charged - Shipping charged to customer
 * @param {number} input.discounts - Discounts applied
 * @param {number} input.refunds - Refunds issued
 * @param {number} input.sales_tax - Sales tax (excluded from revenue)
 * @param {number} input.cost_of_goods - Materials + packaging cost
 * @param {Object} feeConfig - Fee configuration (optional, uses defaults if not provided)
 * @returns {Object} Detailed profit breakdown
 */
export function calculateProfit(input, feeConfig = DEFAULT_FEE_CONFIG) {
  const {
    sales_price = 0,
    shipping_charged = 0,
    discounts = 0,
    refunds = 0,
    sales_tax = 0,
    cost_of_goods = 0,
  } = input;

  const config = { ...DEFAULT_FEE_CONFIG, ...feeConfig };

  // Calculate revenue (excludes sales tax)
  const gross_revenue = sales_price + shipping_charged - discounts - refunds;
  
  // Etsy Listing Fee (flat per listing)
  const listing_fee = config.etsy_listing_fee || 0.20;
  
  // Etsy Transaction Fee (percentage of item price + shipping, before discounts)
  const transaction_base = sales_price + shipping_charged;
  const transaction_fee = (transaction_base * (config.etsy_transaction_fee_percent || 6.5)) / 100;
  
  // Payment Processing Fee (percentage + fixed, applied to total charged to customer)
  const payment_base = gross_revenue + sales_tax; // includes tax for processing
  const processing_fee = 
    (payment_base * (config.payment_processing_fee_percent || 3)) / 100 + 
    (config.payment_processing_fee_fixed || 0.25);
  
  // Total Fees
  const total_fees = listing_fee + transaction_fee + processing_fee;
  
  // Net revenue after fees
  const net_revenue = gross_revenue - total_fees;
  
  // Profit
  const profit = net_revenue - cost_of_goods;
  
  // Margin
  const profit_margin = gross_revenue > 0 ? (profit / gross_revenue) * 100 : 0;
  
  return {
    // Revenue
    gross_revenue,
    sales_tax,
    
    // Fee Breakdown
    listing_fee,
    transaction_fee,
    processing_fee,
    total_fees,
    
    // Bottom Line
    net_revenue,
    cost_of_goods,
    profit,
    profit_margin,
    
    // Additional metrics
    revenue_after_cogs: net_revenue - cost_of_goods,
    effective_fee_rate: gross_revenue > 0 ? (total_fees / gross_revenue) * 100 : 0,
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