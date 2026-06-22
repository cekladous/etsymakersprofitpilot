/**
 * SINGLE SOURCE OF TRUTH FOR ALL FINANCIAL DATA
 * Implements plain-English rules matching the spreadsheet
 * Used by Dashboard, Monthly Summary, Orders, and all drill-downs
 */

/**
 * Safely convert any value to a number, defaulting to 0
 */
const toNumber = (v) => {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
};

export function aggregateFinancials(data, dateRange) {
  const { start, end } = dateRange || {};
  
  if (!start || !end) {
    return {
      revenue: { total: 0, etsyRefunds: 0, netEtsySales: 0 },
      sellingExpenses: { total: 0, shareSaveRefunds: 0 },
      productExpenses: { total: 0, materialsSupplies: 0 },
      businessExpenses: { total: 0 },
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      cashflow: { etsyDeposits: 0, ownerTransfers: 0 },
      unmatchedLedgerEntries: [],
      unmatchedStatementLines: [],
      unmatchedNetImpact: 0,
      deduplicationWarnings: [],
      _rawData: { etsyOrders: [], customSales: [], businessExpenses: [], transfers: [], materialPurchases: [], etsyLedgerEntries: [], expenses: [], fees: [] }
    };
  }
  
  const filterByDate = (items, dateField) => {
    return (items || []).filter(item => {
      const d = new Date(item[dateField]);
      return d >= start && d <= end;
    });
  };

  // Filter all data by date range
  const periodEtsyOrders = filterByDate(Array.isArray(data.etsyOrders) ? data.etsyOrders : [], "sale_date");
  const periodCustomSales = filterByDate(Array.isArray(data.customSales) ? data.customSales : [], "date");
  const periodBusinessExpenses = filterByDate(Array.isArray(data.businessExpenses) ? data.businessExpenses : [], "date");
  const periodTransfers = filterByDate(Array.isArray(data.transfers) ? data.transfers : [], "date");
  const periodMaterialPurchases = filterByDate(Array.isArray(data.materialPurchases) ? data.materialPurchases : [], "purchase_date");
  
  // CRITICAL: Exclude replaced imports when reading ledger entries
  const periodLedgerEntries = filterByDate(Array.isArray(data.etsyLedgerEntries) ? data.etsyLedgerEntries : [], "entry_date");
  
  // Filter out fees from replaced imports
  const periodFees = filterByDate(Array.isArray(data.fees) ? data.fees : [], "transaction_date")
    .filter(fee => {
      // Only include fees from active imports (not replaced)
      if (!fee.import_id) return true; // Keep fees without import tracking
      const feeImport = (data.etsyStatementImports || []).find(imp => imp.id === fee.import_id);
      return !feeImport || feeImport.status !== 'replaced';
    });
  
  // CRITICAL: Include legacy Expense entity (only reviewed ones, include both old and new category names)
  const periodLegacyExpenses = filterByDate(Array.isArray(data.expenses) ? data.expenses : [], "date")
    .filter(e => e.type !== "return");

  // ==================== DEDUPLICATION LOGIC ====================
  // CRITICAL: Prevent double-counting Etsy transactions
  // Rule: EtsyStatementLine is CANONICAL source (from Monthly Statement CSV)
  //       If EtsyStatementLine has source_etsy_order_id, EXCLUDE that EtsyOrder from calculations
  const periodStatementLines = filterByDate(Array.isArray(data.etsyStatementLines) ? data.etsyStatementLines : [], "transaction_date")
    .filter(line => {
      if (!line.import_id) return false;
      const lineImport = (data.etsyStatementImports || []).find(imp => imp.id === line.import_id);
      return lineImport && lineImport.status !== 'replaced';
    });

  // Build set of EtsyOrder IDs that are linked to statement lines (should be excluded from revenue calc)
  const linkedOrderIds = new Set();
  periodStatementLines.forEach(line => {
    if (line.source_etsy_order_id) {
      linkedOrderIds.add(line.source_etsy_order_id);
    }
  });

  // Filter orders: exclude those linked to statement lines (to avoid double-counting)
  const deduplicationWarnings = [];
  const dedupedEtsyOrders = periodEtsyOrders.filter(o => !linkedOrderIds.has(o.id));
  if (linkedOrderIds.size > 0) {
    deduplicationWarnings.push(`${linkedOrderIds.size} EtsyOrder records excluded (using EtsyStatementLine as canonical source)`);
  }

  // ==================== A) REVENUE ====================
  
  // 1) Etsy Sales - item price + shipping charged (buyer-paid revenue)
  // Use dedupedEtsyOrders to exclude orders that came from statement import
  const etsySales = dedupedEtsyOrders.reduce((sum, o) => 
    sum + toNumber(o.order_value) + toNumber(o.shipping_charged), 0);
  
  // 2) Tax Collected by Etsy (excluded from profit)
  const taxCollectedByEtsy = dedupedEtsyOrders.reduce((sum, o) => 
    sum + toNumber(o.sales_tax), 0);
  
  // 3) Total Etsy Sales (includes tax for reporting)
  const totalEtsySales = etsySales + taxCollectedByEtsy;
  
  // 4) Etsy Refunds - CANONICAL: from orders (per-order data is most reliable)
  const refundsFromOrders = dedupedEtsyOrders.reduce((sum, o) => 
    sum + toNumber(o.refund_amount || 0), 0);

  const etsyRefundsFromLedger = periodLedgerEntries
    .filter(e => {
      const title = (e.title || "").toLowerCase();
      const type = (e.type || "").toLowerCase();
      const info = (e.info || "").toLowerCase();
      return e.matched_category === "etsy_refunds" || 
             type.includes("refund") ||
             title.includes("refund to buyer for sales tax") ||
             title.includes("refund to buyer for vat");
    })
    .reduce((sum, e) => sum + Math.abs(toNumber(e.net)), 0);

  // ALWAYS use order refunds as canonical (they're per-order, more reliable)
  // But warn if ledger refunds differ significantly
  const etsyRefunds = refundsFromOrders;
  const refundDifference = Math.abs(refundsFromOrders - etsyRefundsFromLedger);
  const refundDifferencePercent = refundsFromOrders > 0 ? (refundDifference / refundsFromOrders) * 100 : 0;
  if (refundDifference > 0.01 && refundDifferencePercent > 5) {
    deduplicationWarnings.push(
      `Refund discrepancy detected: Orders show $${refundsFromOrders.toFixed(2)}, ` +
      `Ledger shows $${etsyRefundsFromLedger.toFixed(2)}. Using order refunds (canonical source).`
    );
  }
  
  // 5) Custom Sales A/B - use pre_tax_amount as revenue
  const customSaleA = periodCustomSales
    .filter(s => s.sale_type === "A")
    .reduce((sum, s) => sum + toNumber(s.pre_tax_amount || s.gross_sale), 0);
  
  const customSaleB = periodCustomSales
    .filter(s => s.sale_type === "B")
    .reduce((sum, s) => sum + toNumber(s.pre_tax_amount || s.gross_sale), 0);
  
  // Sales tax collected on Custom Sales (tracked separately, excluded from profit)
  const customSalesTaxCollected = periodCustomSales.reduce((sum, s) => 
    sum + toNumber(s.sales_tax_collected), 0);
  
  // 6) Total Revenue (tax excluded from profit logic)
  const totalRevenue = (totalEtsySales - etsyRefunds) + customSaleA + customSaleB;

  // 7) Revenue by Source breakdown (Etsy + each Custom Sales source)
  const SOURCE_KEYS = ["Squarespace", "Square", "In-Person/Cash", "Website", "Instagram", "Other"];
  const customRevenueBySource = {};
  SOURCE_KEYS.forEach(key => { customRevenueBySource[key] = 0; });
  periodCustomSales.forEach(s => {
    const source = SOURCE_KEYS.includes(s.sales_source) ? s.sales_source : "Other";
    customRevenueBySource[source] += toNumber(s.pre_tax_amount || s.gross_sale);
  });
  const revenueBySource = {
    Etsy: totalEtsySales - etsyRefunds,
    ...customRevenueBySource,
  };

  // ==================== B) SELLING EXPENSES ====================

  /**
   * Calculate confidence score for ledger matching (0-100)
   * Prevents false positives from overly broad keyword matches
   */
  const calculateMatchConfidence = (entry, keywords) => {
    const title = (entry.title || "").toLowerCase();
    const type = (entry.type || "").toLowerCase();
    const info = (entry.info || "").toLowerCase();
    const combined = `${type} ${title} ${info}`;

    // Find matching keyword and its specificity
    let bestScore = 0;
    for (const kw of keywords) {
      const pattern = kw.toLowerCase().replace("*", "");
      if (!combined.includes(pattern)) continue;

      // Confidence scoring:
      // - Exact match in type field: 100%
      // - Exact match in title field: 90%
      // - Exact match in info field: 70%
      // - Longer keywords = higher confidence (less broad)
      const typeMatch = type.includes(pattern);
      const titleMatch = title.includes(pattern);
      const infoMatch = info.includes(pattern);

      let score = 0;
      if (typeMatch) score = Math.max(score, 100);
      else if (titleMatch) score = Math.max(score, 90);
      else if (infoMatch) score = Math.max(score, 70);

      // Boost confidence for longer, more specific keywords
      const lengthBoost = Math.min(pattern.length / 30 * 10, 10);
      score = Math.min(100, score + lengthBoost);

      bestScore = Math.max(bestScore, score);
    }

    return bestScore;
  };

  /**
   * Helper to match ledger rows by keywords with confidence threshold
   * Returns entries with confidence >= 80% by default
   */
  const matchLedgerRows = (keywords, minConfidence = 80) => {
    return periodLedgerEntries.filter(e => {
      const confidence = calculateMatchConfidence(e, keywords);
      return confidence >= minConfidence;
    });
  };

  /**
   * Sum ledger rows as expenses (normalize: fees add, credits reduce)
   */
  const sumLedgerExpense = (rows) => {
    return rows.reduce((sum, e) => {
      const net = toNumber(e.net);
      const title = (e.title || "").toLowerCase();
      const isCredit = title.includes("credit") || title.includes("refund") || net > 0;
      
      // If it's a credit/refund, it reduces expenses
      // If it's a fee charge (negative net), it increases expenses
      return sum + (isCredit ? -Math.abs(net) : Math.abs(net));
    }, 0);
  };

  // 1) Etsy Listing Fees (prioritize Fee entity from statement imports)
  const listingFeesFromFees = periodFees
    .filter(f => f.fee_type === 'listing')
    .reduce((sum, f) => sum + Math.abs(toNumber(f.amount)), 0);
  
  const listingFeeRows = matchLedgerRows([
    "listing fee*",
    "credit for listing fee*",
    "tax: auto-renew",
    "tax: listing"
  ]);
  const listingFeesFromLedger = toNumber(sumLedgerExpense(listingFeeRows));
  const legacyListingFees = periodLegacyExpenses
    .filter(e => ["etsy_listing_fees"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const etsyListingFees = toNumber(listingFeesFromFees || (listingFeesFromLedger + legacyListingFees));

  // 2) Etsy Transaction Fees (prioritize Fee entity from statement imports)
  const transactionFeesFromFees = periodFees
    .filter(f => f.fee_type === 'transaction')
    .reduce((sum, f) => sum + Math.abs(toNumber(f.amount)), 0);
  
  const transactionFeeRows = matchLedgerRows([
    "transaction fee*",
    "credit for transaction fee*",
    "tax: transaction*"
  ]);
  const transactionFeesFromLedger = toNumber(sumLedgerExpense(transactionFeeRows));
  const legacyTransactionFees = periodLegacyExpenses
    .filter(e => ["etsy_transaction_fees"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const etsyTransactionFees = toNumber(transactionFeesFromFees || (transactionFeesFromLedger + legacyTransactionFees));

  // 3) Etsy Processing Fees (prioritize Fee entity from statement imports)
  const processingFeesFromFees = periodFees
    .filter(f => f.fee_type === 'processing')
    .reduce((sum, f) => sum + Math.abs(toNumber(f.amount)), 0);
  
  const processingFeeRows = matchLedgerRows([
    "processing fee*",
    "credit for processing fee*",
    "tax: processing fee*"
  ]);
  const processingFeesFromLedger = toNumber(sumLedgerExpense(processingFeeRows));
  const legacyProcessingFees = periodLegacyExpenses
    .filter(e => ["etsy_processing_fees"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const etsyProcessingFees = toNumber(processingFeesFromFees || (processingFeesFromLedger + legacyProcessingFees));

  // 4) Share & Save Fee Refunds & Misc. Credits (NEGATIVE = credits that reduce fees)
  const shareSaveRows = matchLedgerRows([
    "share & save refund*",
    "etsy miscellaneous credit*"
  ]);
  const shareSaveFromLedger = toNumber(sumLedgerExpense(shareSaveRows)); // Already negative from sumLedgerExpense
  const legacyShareSave = periodLegacyExpenses
    .filter(e => ["share_save_refunds_credits"].includes(e.category))
    .reduce((sum, e) => sum - toNumber(e.amount), 0); // Credits reduce expenses (negative)
  const shareSaveRefunds = toNumber(shareSaveFromLedger + legacyShareSave); // Already negative

  // 5) Other Fees
  const otherFeeRows = matchLedgerRows([
    "buyer fee*",
    "regulatory operating fee*",
    "tax: regulatory operating fee*"
  ]);
  const otherFeesFromLedger = toNumber(sumLedgerExpense(otherFeeRows));
  const legacyOtherFees = periodLegacyExpenses
    .filter(e => ["other_fees"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const otherFees = toNumber(otherFeesFromLedger + legacyOtherFees);

  // 6) Etsy Ads (prioritize Fee entity from statement imports)
  const adsFeesFromFees = periodFees
    .filter(f => f.fee_type === 'etsy_ads')
    .reduce((sum, f) => sum + Math.abs(toNumber(f.amount)), 0);
  
  const adsRows = matchLedgerRows([
    "etsy ads",
    "refund for invalid etsy ads clicks",
    "etsy plus subscription fee*",
    "sales tax on etsy plus subscription fee*",
    "credit for etsy ads fee*"
  ]);
  const adsFromLedger = toNumber(sumLedgerExpense(adsRows));
  const legacyAds = periodLegacyExpenses
    .filter(e => ["etsy_ads"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const etsyAds = toNumber(adsFeesFromFees || (adsFromLedger + legacyAds));

  // 7) Etsy Offsite Ads Fees (prioritize Fee entity from statement imports)
  const offsiteAdsFeesFromFees = periodFees
    .filter(f => f.fee_type === 'offsite_ads')
    .reduce((sum, f) => sum + Math.abs(toNumber(f.amount)), 0);
  
  const offsiteAdsRows = matchLedgerRows(["offsite ads"]);
  const offsiteAdsFromLedger = toNumber(sumLedgerExpense(offsiteAdsRows));
  const legacyOffsiteAds = periodLegacyExpenses
    .filter(e => ["etsy_offsite_ads_fees"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const etsyOffsiteAds = toNumber(offsiteAdsFeesFromFees || (offsiteAdsFromLedger + legacyOffsiteAds));

  // 8) Total Etsy Fees
  const totalEtsyFees = toNumber(
    etsyListingFees + etsyTransactionFees + etsyProcessingFees + 
    shareSaveRefunds + otherFees + etsyAds + etsyOffsiteAds
  );

  // 9) Etsy Shipping (shipping labels - prioritize Fee entity from statement imports)
  const shippingFeesFromFees = periodFees
    .filter(f => f.fee_type === 'shipping_label')
    .reduce((sum, f) => sum + Math.abs(toNumber(f.amount)), 0);
  
  const shippingRows = matchLedgerRows([
    "shipping label",
    "postage",
    "etsy shipping"
  ]).filter(e => {
    const type = (e.type || "").toLowerCase();
    return type.includes("shipping");
  });
  const shippingFromLedger = toNumber(sumLedgerExpense(shippingRows));
  const legacyShipping = periodLegacyExpenses
    .filter(e => ["etsy_shipping"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const etsyShipping = toNumber(shippingFeesFromFees || (shippingFromLedger + legacyShipping));

  // 10) Other Postage Costs (from manual entries)
  const otherPostageFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "other_postage_costs")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const legacyOtherPostage = periodLegacyExpenses
    .filter(e => ["other_postage_costs"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const otherPostage = toNumber(otherPostageFromBE + legacyOtherPostage);

  // ==================== C) PRODUCT EXPENSES ====================
  
  // 1) Materials & Supplies
  const materialsCost = periodMaterialPurchases.reduce((sum, p) => 
    sum + toNumber(p.total_cost), 0);
  
  const materialsExpense = periodBusinessExpenses
    .filter(e => e.category_name === "materials_supplies")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  // CRITICAL: Include legacy Expense entity materials (both old and new category names)
  const legacyMaterials = periodLegacyExpenses
    .filter(e => ["materials", "packaging", "materials_supplies"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const totalMaterialsSupplies = toNumber(materialsCost + materialsExpense + legacyMaterials);
  
  // 2) Tools & Equipment
  const toolsEquipmentFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "tools_equipment")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const legacyTools = periodLegacyExpenses
    .filter(e => ["tools", "equipment", "tools_equipment"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const toolsEquipment = toNumber(toolsEquipmentFromBE + legacyTools);

  // ==================== D) BUSINESS EXPENSES ====================
  
  const advertisingMarketingFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "advertising_marketing")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const legacyAdvertising = periodLegacyExpenses
    .filter(e => ["advertising", "software", "advertising_marketing"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const advertisingMarketing = toNumber(advertisingMarketingFromBE + legacyAdvertising);
  
  const officeExpensesFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "office_general_expenses")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const legacyOffice = periodLegacyExpenses
    .filter(e => ["utilities", "office_general_expenses", "office_expenses"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const officeExpenses = toNumber(officeExpensesFromBE + legacyOffice);
  
  const gasMileageFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "gas_mileage")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const utilitiesCellPhoneFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "utilities_cell_phone")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const professionalServicesFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "professional_services")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const legacyProfessional = periodLegacyExpenses
    .filter(e => ["professional_services"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const professionalServices = toNumber(professionalServicesFromBE + legacyProfessional);
  
  const otherBusinessExpensesFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "other")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const legacyOther = periodLegacyExpenses
    .filter(e => ["other", "maintenance", "shipping"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const otherBusinessExpenses = toNumber(otherBusinessExpensesFromBE + legacyOther);
  
  const miscellaneousExpensesFromBE = periodBusinessExpenses
    .filter(e => e.category_name === "miscellaneous_expenses")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const legacyMisc = periodLegacyExpenses
    .filter(e => ["miscellaneous_expenses"].includes(e.category))
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  
  const miscellaneousExpenses = toNumber(miscellaneousExpensesFromBE + legacyMisc);
  


  // ==================== E) TOTALS ====================
  
  // 1) Total Expenses (Order Fees + Business Expenses - Fee Credits)
  const totalSellingExpenses = toNumber(totalEtsyFees + etsyShipping + otherPostage);
  const totalProductExpenses = toNumber(totalMaterialsSupplies + toolsEquipment);
  const totalBusinessExpenses = toNumber(
    advertisingMarketing + officeExpenses + gasMileageFromBE + 
    utilitiesCellPhoneFromBE + professionalServices + 
    otherBusinessExpenses + miscellaneousExpenses
  );
  
  // CRITICAL: Total Expenses = Fees + Product + Business
  // This MUST match Expenses page total for same date range
  const totalExpenses = toNumber(totalSellingExpenses + totalProductExpenses + totalBusinessExpenses);
  
  // 2) Net Profit (tax collected excluded from profit)
  const netProfit = toNumber(totalRevenue - totalExpenses);
  
  // 3) Deposits from Etsy (cashflow, not revenue)
  const etsyDeposits = periodTransfers
    .filter(t => t.type === "etsy_deposit")
    .reduce((sum, t) => sum + toNumber(t.amount), 0);
  
  // 4) Owner Transfers / Take Home Pay
  const ownerTransfers = periodTransfers
    .filter(t => t.type === "owner_transfer")
    .reduce((sum, t) => sum + toNumber(t.amount), 0);

  // ==================== F) UNMATCHED ====================
  
  // CRITICAL: Unmatched entries are EXCLUDED from profit calculations
  // They represent unknown fees/credits that could significantly impact actual profit
  // Force user to reconcile before finalizing monthly numbers
  
  const unmatchedLedgerEntries = periodLedgerEntries.filter(e => {
    // Flag as unmatched if explicitly unmatched OR if auto-matched with low confidence
    if (e.status === "Unmatched" || !e.matched_category) return true;
    
    // Check if entry was auto-matched but has low confidence
    if (e.matched_category) {
      // Re-evaluate with confidence scoring to flag uncertain matches
      const categoryKeywordMap = {
        'etsy_listing_fees': ["listing fee", "credit for listing fee", "tax: auto-renew", "tax: listing"],
        'etsy_transaction_fees': ["transaction fee", "credit for transaction fee", "tax: transaction"],
        'etsy_processing_fees': ["processing fee", "credit for processing fee", "tax: processing fee"],
        'share_save_refunds_credits': ["share & save refund", "etsy miscellaneous credit"],
        'other_fees': ["buyer fee", "regulatory operating fee", "tax: regulatory operating fee"],
        'etsy_ads': ["etsy ads", "refund for invalid etsy ads clicks", "etsy plus subscription fee", "credit for etsy ads fee"],
        'etsy_offsite_ads_fees': ["offsite ads"],
        'etsy_shipping': ["shipping label", "postage", "etsy shipping"]
      };
      
      const keywords = categoryKeywordMap[e.matched_category] || [];
      const confidence = calculateMatchConfidence(e, keywords);
      return confidence < 80; // Flag low-confidence matches for review
    }
    
    return false;
  });
  
  // Calculate NET IMPACT of unmatched ledger entries (expenses reduce profit, credits increase it)
  const unmatchedLedgerNetImpact = unmatchedLedgerEntries.reduce((sum, e) => 
    sum + toNumber(e.net), 0);
  
  // Also check for unmatched statement lines (from new imports)
  const unmatchedStatementLines = filterByDate(Array.isArray(data.etsyStatementLines) ? data.etsyStatementLines : [], "transaction_date")
    .filter(line => {
      // Only include lines from active imports (not replaced)
      if (!line.import_id) return false;
      const lineImport = (data.etsyStatementImports || []).find(imp => imp.id === line.import_id);
      if (!lineImport || lineImport.status === 'replaced') return false;
      return !line.matched || line.category === 'unmatched';
    });
  
  const unmatchedStatementNetImpact = unmatchedStatementLines.reduce((sum, l) => 
    sum + toNumber(l.amount), 0);
  
  // TOTAL unmatched net impact (if positive/negative, it affects actual profit)
  const unmatchedNetImpact = unmatchedLedgerNetImpact + unmatchedStatementNetImpact;

  return {
    // Revenue breakdown
    revenue: {
      etsySales,
      taxCollectedByEtsy,
      totalEtsySales,
      etsyRefunds,
      netEtsySales: totalEtsySales - etsyRefunds, // CRITICAL: Show net after refunds
      customSaleA,
      customSaleB,
      customSalesTaxCollected,
      customRevenueTotal: customSaleA + customSaleB, // NEW: Total custom revenue (non-Etsy)
      total: totalRevenue,
      bySource: revenueBySource, // NEW: Revenue broken down by sales source
    },
    
    // Selling expenses breakdown
    sellingExpenses: {
      etsyListingFees,
      etsyTransactionFees,
      etsyProcessingFees,
      shareSaveRefunds, // NOTE: Negative value (credit)
      otherFees,
      etsyAds,
      etsyOffsiteAds,
      totalEtsyFees,
      etsyShipping,
      otherPostage,
      total: totalSellingExpenses,
    },
    
    // Product expenses breakdown
    productExpenses: {
      materialsSupplies: totalMaterialsSupplies,
      toolsEquipment,
      total: totalProductExpenses,
    },
    
    // Business expenses breakdown
    businessExpenses: {
      advertisingMarketing,
      officeExpenses,
      gasMileage: gasMileageFromBE,
      utilitiesCellPhone: utilitiesCellPhoneFromBE,
      professionalServices,
      other: otherBusinessExpenses,
      miscellaneous: miscellaneousExpenses,
      total: totalBusinessExpenses,
    },
    
    // Grand totals
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null,
    
    // Cashflow (not revenue)
    cashflow: {
      etsyDeposits,
      ownerTransfers,
    },
    
    // Alerts: CRITICAL - Unmatched entries are EXCLUDED from profit
    // User MUST reconcile these before financial numbers are reliable
    unmatchedLedgerEntriesCount: unmatchedLedgerEntries.length,
    unmatchedStatementLinesCount: unmatchedStatementLines.length,
    unmatchedNetImpact, // Total $ impact of unmatched entries (affects actual profit)
    hasUnmatchedEntries: unmatchedLedgerEntries.length > 0 || unmatchedStatementLines.length > 0,
    
    // Deduplication warnings
    deduplicationWarnings,
    
    // Raw filtered data for drill-downs
    _rawData: {
      etsyOrders: dedupedEtsyOrders,
      customSales: periodCustomSales,
      businessExpenses: periodBusinessExpenses,
      transfers: periodTransfers,
      materialPurchases: periodMaterialPurchases,
      etsyLedgerEntries: periodLedgerEntries,
      expenses: periodLegacyExpenses,
      fees: periodFees,
      statementLines: periodStatementLines,
    },
  };
}

/**
 * Auto-classify Etsy Payment Ledger rows (enhanced for new rules)
 */
export function classifyEtsyLedgerEntry(entry) {
  const type = (entry.type || "").toLowerCase();
  const title = (entry.title || "").toLowerCase();
  const info = (entry.info || "").toLowerCase();
  const combined = `${type} ${title} ${info}`;

  // Deposits (cashflow, not revenue)
  if (type.includes("deposit") || type.includes("payment") || combined.includes("deposit")) {
    return { category: "etsy_deposit", status: "Matched" };
  }

  // Sales
  if (type.includes("sale") || title.includes("sale") || combined.includes("order #")) {
    return { category: "etsy_sales", status: "Matched" };
  }

  // Refunds (three types)
  if (combined.includes("refund to buyer for sales tax")) {
    return { category: "etsy_refunds", status: "Matched" };
  }
  if (combined.includes("refund to buyer for vat")) {
    return { category: "etsy_refunds", status: "Matched" };
  }
  if (type.includes("refund") || combined.includes("refund")) {
    return { category: "etsy_refunds", status: "Matched" };
  }

  // Listing fees
  if (combined.includes("listing fee") || combined.includes("credit for listing fee") ||
      combined.includes("tax: auto-renew") || combined.includes("tax: listing")) {
    return { category: "etsy_listing_fees", status: "Matched" };
  }

  // Transaction fees
  if (combined.includes("transaction fee") || combined.includes("credit for transaction fee") ||
      combined.includes("tax: transaction")) {
    return { category: "etsy_transaction_fees", status: "Matched" };
  }

  // Processing fees
  if (combined.includes("processing fee") || combined.includes("credit for processing fee") ||
      combined.includes("tax: processing fee")) {
    return { category: "etsy_processing_fees", status: "Matched" };
  }

  // Share & Save / Misc Credits
  if (combined.includes("share & save refund") || combined.includes("etsy miscellaneous credit")) {
    return { category: "share_save_refunds_credits", status: "Matched" };
  }

  // Other Fees
  if (combined.includes("buyer fee") || combined.includes("regulatory operating fee") ||
      combined.includes("tax: regulatory operating fee")) {
    return { category: "other_fees", status: "Matched" };
  }

  // Ads
  if (combined.includes("etsy ads") || combined.includes("refund for invalid etsy ads clicks") ||
      combined.includes("etsy plus subscription fee") || 
      combined.includes("sales tax on etsy plus subscription fee") ||
      combined.includes("credit for etsy ads fee")) {
    return { category: "etsy_ads", status: "Matched" };
  }

  // Offsite ads
  if (combined.includes("offsite ad")) {
    return { category: "etsy_offsite_ads_fees", status: "Matched" };
  }

  // Shipping
  if ((type.includes("shipping") || combined.includes("shipping label") || 
       combined.includes("postage") || combined.includes("etsy shipping")) &&
      !combined.includes("refund")) {
    return { category: "etsy_shipping", status: "Matched" };
  }

  // Default: unmatched
  return { category: null, status: "Unmatched" };
}

/**
 * Extract Etsy order ID from ledger entry
 */
export function extractEtsyOrderId(entry) {
  const combined = `${entry.title || ""} ${entry.info || ""}`;
  const match = combined.match(/order[#\s]*(\d+)/i) || combined.match(/#(\d+)/);
  return match ? match[1] : null;
}