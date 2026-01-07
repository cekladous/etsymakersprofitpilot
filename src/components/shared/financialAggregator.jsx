/**
 * SINGLE SOURCE OF TRUTH FOR ALL FINANCIAL DATA
 * Implements plain-English rules matching the spreadsheet
 * Used by Dashboard, Monthly Summary, Orders, and all drill-downs
 */

export function aggregateFinancials(data, dateRange) {
  const { start, end } = dateRange;
  
  const filterByDate = (items, dateField) => {
    return items.filter(item => {
      const d = new Date(item[dateField]);
      return d >= start && d <= end;
    });
  };

  // Filter all data by date range
  const periodEtsyOrders = filterByDate(data.etsyOrders || [], "sale_date");
  const periodCustomSales = filterByDate(data.customSales || [], "date");
  const periodBusinessExpenses = filterByDate(data.businessExpenses || [], "date");
  const periodTransfers = filterByDate(data.transfers || [], "date");
  const periodMaterialPurchases = filterByDate(data.materialPurchases || [], "purchase_date");
  const periodLedgerEntries = filterByDate(data.etsyLedgerEntries || [], "entry_date");

  // ==================== A) REVENUE ====================
  
  // 1) Etsy Sales - item price + shipping charged (buyer-paid revenue)
  const etsySales = periodEtsyOrders.reduce((sum, o) => 
    sum + (o.order_value || 0) + (o.shipping_charged || 0), 0);
  
  // 2) Tax Collected by Etsy (excluded from profit)
  const taxCollectedByEtsy = periodEtsyOrders.reduce((sum, o) => 
    sum + (o.sales_tax || 0), 0);
  
  // 3) Total Etsy Sales (includes tax for reporting)
  const totalEtsySales = etsySales + taxCollectedByEtsy;
  
  // 4) Etsy Refunds - three components
  const etsyRefunds = periodLedgerEntries
    .filter(e => {
      const title = (e.title || "").toLowerCase();
      const type = (e.type || "").toLowerCase();
      const info = (e.info || "").toLowerCase();
      return e.matched_category === "etsy_refunds" || 
             type.includes("refund") ||
             title.includes("refund to buyer for sales tax") ||
             title.includes("refund to buyer for vat");
    })
    .reduce((sum, e) => sum + Math.abs(e.net || 0), 0);
  
  // 5) Custom Sales A/B - use pre_tax_amount as revenue
  const customSaleA = periodCustomSales
    .filter(s => s.sale_type === "A")
    .reduce((sum, s) => sum + (s.pre_tax_amount || s.gross_sale || 0), 0);
  
  const customSaleB = periodCustomSales
    .filter(s => s.sale_type === "B")
    .reduce((sum, s) => sum + (s.pre_tax_amount || s.gross_sale || 0), 0);
  
  // Sales tax collected on Custom Sales (tracked separately, excluded from profit)
  const customSalesTaxCollected = periodCustomSales.reduce((sum, s) => 
    sum + (s.sales_tax_collected || 0), 0);
  
  // 6) Total Revenue (tax excluded from profit logic)
  const totalRevenue = (totalEtsySales - etsyRefunds) + customSaleA + customSaleB;

  // ==================== B) SELLING EXPENSES ====================
  
  /**
   * Helper to match ledger rows by keywords (case-insensitive, wildcard)
   */
  const matchLedgerRows = (keywords) => {
    return periodLedgerEntries.filter(e => {
      const title = (e.title || "").toLowerCase();
      const type = (e.type || "").toLowerCase();
      const info = (e.info || "").toLowerCase();
      const combined = `${type} ${title} ${info}`;
      
      return keywords.some(kw => {
        const pattern = kw.toLowerCase().replace("*", "");
        return combined.includes(pattern);
      });
    });
  };

  /**
   * Sum ledger rows as expenses (normalize: fees add, credits reduce)
   */
  const sumLedgerExpense = (rows) => {
    return rows.reduce((sum, e) => {
      const net = e.net || 0;
      const title = (e.title || "").toLowerCase();
      const isCredit = title.includes("credit") || title.includes("refund") || net > 0;
      
      // If it's a credit/refund, it reduces expenses
      // If it's a fee charge (negative net), it increases expenses
      return sum + (isCredit ? -Math.abs(net) : Math.abs(net));
    }, 0);
  };

  // 1) Etsy Listing Fees
  const listingFeeRows = matchLedgerRows([
    "listing fee*",
    "credit for listing fee*",
    "tax: auto-renew",
    "tax: listing"
  ]);
  const etsyListingFees = sumLedgerExpense(listingFeeRows);

  // 2) Etsy Transaction Fees
  const transactionFeeRows = matchLedgerRows([
    "transaction fee*",
    "credit for transaction fee*",
    "tax: transaction*"
  ]);
  const etsyTransactionFees = sumLedgerExpense(transactionFeeRows);

  // 3) Etsy Processing Fees
  const processingFeeRows = matchLedgerRows([
    "processing fee*",
    "credit for processing fee*",
    "tax: processing fee*"
  ]);
  const etsyProcessingFees = sumLedgerExpense(processingFeeRows);

  // 4) Share & Save Fee Refunds & Misc. Credits
  const shareSaveRows = matchLedgerRows([
    "share & save refund*",
    "etsy miscellaneous credit*"
  ]);
  const shareSaveRefunds = sumLedgerExpense(shareSaveRows);

  // 5) Other Fees
  const otherFeeRows = matchLedgerRows([
    "buyer fee*",
    "regulatory operating fee*",
    "tax: regulatory operating fee*"
  ]);
  const otherFees = sumLedgerExpense(otherFeeRows);

  // 6) Etsy Ads
  const adsRows = matchLedgerRows([
    "etsy ads",
    "refund for invalid etsy ads clicks",
    "etsy plus subscription fee*",
    "sales tax on etsy plus subscription fee*",
    "credit for etsy ads fee*"
  ]);
  const etsyAds = sumLedgerExpense(adsRows);

  // 7) Etsy Offsite Ads Fees
  const offsiteAdsRows = matchLedgerRows(["offsite ads"]);
  const etsyOffsiteAds = sumLedgerExpense(offsiteAdsRows);

  // 8) Total Etsy Fees
  const totalEtsyFees = 
    etsyListingFees + etsyTransactionFees + etsyProcessingFees + 
    shareSaveRefunds + otherFees + etsyAds + etsyOffsiteAds;

  // 9) Etsy Shipping (shipping labels)
  const shippingRows = matchLedgerRows([
    "shipping label",
    "postage",
    "etsy shipping"
  ]).filter(e => {
    const type = (e.type || "").toLowerCase();
    return type.includes("shipping");
  });
  const etsyShipping = sumLedgerExpense(shippingRows);

  // 10) Other Postage Costs (from manual entries)
  const otherPostage = periodBusinessExpenses
    .filter(e => e.category_name === "other_postage_costs")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // ==================== C) PRODUCT EXPENSES ====================
  
  // 1) Materials & Supplies
  const materialsCost = periodMaterialPurchases.reduce((sum, p) => 
    sum + (p.total_cost || 0), 0);
  
  const materialsExpense = periodBusinessExpenses
    .filter(e => e.category_name === "materials_supplies")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const totalMaterialsSupplies = materialsCost + materialsExpense;
  
  // 2) Tools & Equipment
  const toolsEquipment = periodBusinessExpenses
    .filter(e => e.category_name === "tools_equipment")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // ==================== D) BUSINESS EXPENSES ====================
  
  const advertisingMarketing = periodBusinessExpenses
    .filter(e => e.category_name === "advertising_marketing")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const officeExpenses = periodBusinessExpenses
    .filter(e => e.category_name === "office_expenses")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const professionalServices = periodBusinessExpenses
    .filter(e => e.category_name === "professional_services")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const otherBusinessExpenses = periodBusinessExpenses
    .filter(e => e.category_name === "other")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const miscellaneousExpenses = periodBusinessExpenses
    .filter(e => e.category_name === "miscellaneous_expenses")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // ==================== E) TOTALS ====================
  
  // 1) Total Expenses
  const totalSellingExpenses = totalEtsyFees + etsyShipping + otherPostage;
  const totalProductExpenses = totalMaterialsSupplies + toolsEquipment;
  const totalBusinessExpenses = 
    advertisingMarketing + officeExpenses + professionalServices + 
    otherBusinessExpenses + miscellaneousExpenses;
  
  const totalExpenses = totalSellingExpenses + totalProductExpenses + totalBusinessExpenses;
  
  // 2) Net Profit (tax collected excluded from profit)
  const netProfit = totalRevenue - totalExpenses;
  
  // 3) Deposits from Etsy (cashflow, not revenue)
  const etsyDeposits = periodTransfers
    .filter(t => t.type === "etsy_deposit")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  // 4) Owner Transfers / Take Home Pay
  const ownerTransfers = periodTransfers
    .filter(t => t.type === "owner_transfer")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // ==================== F) UNMATCHED ====================
  
  const unmatchedLedgerEntries = periodLedgerEntries.filter(e => 
    e.status === "Unmatched" || !e.matched_category
  );
  
  const unmatchedNetImpact = unmatchedLedgerEntries.reduce((sum, e) => 
    sum + (e.net || 0), 0);

  return {
    // Revenue breakdown
    revenue: {
      etsySales,
      taxCollectedByEtsy,
      totalEtsySales,
      etsyRefunds,
      customSaleA,
      customSaleB,
      customSalesTaxCollected,
      total: totalRevenue,
    },
    
    // Selling expenses breakdown
    sellingExpenses: {
      etsyListingFees,
      etsyTransactionFees,
      etsyProcessingFees,
      shareSaveRefunds,
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
      professionalServices,
      other: otherBusinessExpenses,
      miscellaneous: miscellaneousExpenses,
      total: totalBusinessExpenses,
    },
    
    // Grand totals
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    
    // Cashflow (not revenue)
    cashflow: {
      etsyDeposits,
      ownerTransfers,
    },
    
    // Alerts
    unmatchedLedgerEntries,
    unmatchedNetImpact,
    
    // Raw filtered data for drill-downs
    _rawData: {
      etsyOrders: periodEtsyOrders,
      customSales: periodCustomSales,
      businessExpenses: periodBusinessExpenses,
      transfers: periodTransfers,
      materialPurchases: periodMaterialPurchases,
      etsyLedgerEntries: periodLedgerEntries,
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