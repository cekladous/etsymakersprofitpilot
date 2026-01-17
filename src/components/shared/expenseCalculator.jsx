/**
 * Shared expense calculation logic for Dashboard and Expenses page
 * Ensures 1:1 reconciliation between KPI and drilldown
 * 
 * IMPORTANT: This calculates expenses based on the NEW data model:
 * - BusinessExpense entity (selling expenses, product expenses, business expenses)
 * - OrderFee entity (order-level fees from Etsy)
 * 
 * All calculations filter strictly by transaction date (not created_at or imported_at)
 */

/**
 * Calculate total expenses for a given date range
 * Formula: BusinessExpenses + OrderFees - FeeCredits
 * All filtered by transaction date only
 * 
 * @param {Object} params
 * @param {Array} params.etsyOrders - EtsyOrder entities
 * @param {Array} params.orderFees - OrderFee entities  
 * @param {Array} params.businessExpenses - BusinessExpense entities
 * @param {Object} params.dateRange - { start: Date, end: Date }
 * @returns {Object} Breakdown of expenses
 */
export function calculateTotalExpenses({ etsyOrders, orderFees, businessExpenses, dateRange }) {
  if (!dateRange?.start || !dateRange?.end) {
    return {
      orderFees: 0,
      businessExpenses: 0,
      feeCredits: 0,
      totalExpenses: 0,
      orderCount: 0,
    };
  }

  // Filter Etsy orders by transaction date (sale_date)
  const periodEtsyOrders = etsyOrders.filter(o => {
    if (!o.sale_date) return false;
    const d = new Date(o.sale_date);
    return d >= dateRange.start && d <= dateRange.end;
  });

  // Calculate order fees for the period (transaction date = order sale_date)
  const periodOrderFeesTotal = orderFees
    .filter(f => periodEtsyOrders.some(o => o.id === f.order_id))
    .reduce((sum, f) => {
      const fees = (f.listing_fees || 0) + 
                   (f.transaction_fees || 0) + 
                   (f.processing_fees || 0) + 
                   (f.other_fees || 0) + 
                   (f.etsy_ads || 0) + 
                   (f.offsite_ads_fees || 0) + 
                   (f.etsy_shipping || 0) + 
                   (f.other_postage_costs || 0);
      return sum + fees;
    }, 0);

  // Calculate fee credits for the period
  const periodFeeCredits = orderFees
    .filter(f => periodEtsyOrders.some(o => o.id === f.order_id))
    .reduce((sum, f) => sum + (f.share_save_refunds_credits || 0), 0);

  // Calculate business expenses by transaction date (date field)
  const periodBusinessExpenses = businessExpenses
    .filter(e => {
      if (!e?.date) return false;
      const d = new Date(e.date);
      return d >= dateRange.start && d <= dateRange.end;
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Total Expenses = BusinessExpenses + OrderFees - FeeCredits
  const totalExpenses = periodBusinessExpenses + periodOrderFeesTotal - periodFeeCredits;

  return {
    orderFees: periodOrderFeesTotal,
    businessExpenses: periodBusinessExpenses,
    feeCredits: periodFeeCredits,
    totalExpenses,
    orderCount: periodEtsyOrders.length,
  };
}

/**
 * Format currency for display
 */
export function formatExpenseCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}