/**
 * SINGLE SOURCE OF TRUTH FOR ALL FINANCIAL DATA
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

  // === REVENUE ===
  const etsySales = periodEtsyOrders.reduce((sum, o) => sum + (o.order_value || 0), 0);
  const taxCollected = periodEtsyOrders.reduce((sum, o) => sum + (o.sales_tax || 0), 0);
  const etsyRefunds = periodLedgerEntries
    .filter(e => e.matched_category === "etsy_refunds")
    .reduce((sum, e) => sum + Math.abs(e.net || 0), 0);
  
  const customSaleA = periodCustomSales.filter(s => s.sale_type === "A").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  const customSaleB = periodCustomSales.filter(s => s.sale_type === "B").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  const customSaleC = periodCustomSales.filter(s => s.sale_type === "C").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  const customSaleD = periodCustomSales.filter(s => s.sale_type === "D").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  
  const totalRevenue = etsySales - etsyRefunds + customSaleA + customSaleB + customSaleC + customSaleD;

  // === SELLING EXPENSES (ETSY FEES) ===
  const getExpenseTotal = (categoryName) => {
    const fromExpenses = periodBusinessExpenses
      .filter(e => e.category_name === categoryName)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const fromLedger = periodLedgerEntries
      .filter(e => e.matched_category === categoryName)
      .reduce((sum, e) => sum + Math.abs(e.net || 0), 0);
    
    return fromExpenses + fromLedger;
  };

  const etsyListingFees = getExpenseTotal("etsy_listing_fees");
  const etsyTransactionFees = getExpenseTotal("etsy_transaction_fees");
  const etsyProcessingFees = getExpenseTotal("etsy_processing_fees");
  const shareSaveRefunds = getExpenseTotal("share_save_refunds_credits");
  const otherFees = getExpenseTotal("other_fees");
  const etsyAds = getExpenseTotal("etsy_ads");
  const etsyOffsiteAds = getExpenseTotal("etsy_offsite_ads_fees");
  const etsyShipping = getExpenseTotal("etsy_shipping");
  const otherPostage = getExpenseTotal("other_postage_costs");
  const customExpenseA = getExpenseTotal("custom_expense_a");
  const customExpenseB = getExpenseTotal("custom_expense_b");

  const totalSellingExpenses = 
    etsyListingFees + etsyTransactionFees + etsyProcessingFees + 
    shareSaveRefunds + otherFees + etsyAds + etsyOffsiteAds + 
    etsyShipping + otherPostage + customExpenseA + customExpenseB;

  // === PRODUCT EXPENSES ===
  const materialsCost = periodMaterialPurchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);
  const materialsExpense = getExpenseTotal("materials_supplies");
  const totalMaterialsSupplies = materialsCost + materialsExpense;
  
  const toolsEquipment = getExpenseTotal("tools_equipment");
  
  const totalProductExpenses = totalMaterialsSupplies + toolsEquipment;

  // === BUSINESS EXPENSES ===
  const advertisingMarketing = getExpenseTotal("advertising_marketing");
  const officeExpenses = getExpenseTotal("office_expenses");
  const professionalServices = getExpenseTotal("professional_services");
  const otherBusinessExpenses = getExpenseTotal("other");
  const miscellaneousExpenses = getExpenseTotal("miscellaneous_expenses");
  const customExpenseC = getExpenseTotal("custom_expense_c");

  const totalBusinessExpenses = 
    advertisingMarketing + officeExpenses + professionalServices + 
    otherBusinessExpenses + miscellaneousExpenses + customExpenseC;

  // === TOTALS ===
  const totalExpenses = totalSellingExpenses + totalProductExpenses + totalBusinessExpenses;
  const netProfit = totalRevenue - totalExpenses;

  // === CASHFLOW ===
  const etsyDeposits = periodTransfers
    .filter(t => t.type === "etsy_deposit")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const ownerTransfers = periodTransfers
    .filter(t => t.type === "owner_transfer")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // === UNMATCHED LEDGER ENTRIES ===
  const unmatchedLedgerEntries = periodLedgerEntries.filter(e => e.status === "Unmatched");

  return {
    // Revenue breakdown
    revenue: {
      etsySales,
      taxCollected,
      etsyRefunds,
      customSaleA,
      customSaleB,
      customSaleC,
      customSaleD,
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
      etsyShipping,
      otherPostage,
      customExpenseA,
      customExpenseB,
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
      customExpenseC,
      total: totalBusinessExpenses,
    },
    
    // Grand totals
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    
    // Cashflow
    cashflow: {
      etsyDeposits,
      ownerTransfers,
    },
    
    // Alerts
    unmatchedLedgerEntries,
    
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
 * Auto-classify Etsy Payment Ledger rows
 */
export function classifyEtsyLedgerEntry(entry) {
  const type = (entry.type || "").toLowerCase();
  const title = (entry.title || "").toLowerCase();
  const info = (entry.info || "").toLowerCase();
  const combined = `${type} ${title} ${info}`;

  // Deposits
  if (type.includes("deposit") || type.includes("payment")) {
    return { category: "etsy_deposit", status: "Matched" };
  }

  // Sales
  if (type.includes("sale") || title.includes("sale") || combined.includes("order #")) {
    return { category: "etsy_sales", status: "Matched" };
  }

  // Refunds
  if (combined.includes("refund")) {
    return { category: "etsy_refunds", status: "Matched" };
  }

  // Listing fees
  if (combined.includes("listing") || combined.includes("auto-renew")) {
    return { category: "etsy_listing_fees", status: "Matched" };
  }

  // Transaction fees
  if (combined.includes("transaction fee")) {
    return { category: "etsy_transaction_fees", status: "Matched" };
  }

  // Processing fees
  if (combined.includes("processing") || combined.includes("payment processing")) {
    return { category: "etsy_processing_fees", status: "Matched" };
  }

  // Ads
  if (combined.includes("advertising") || combined.includes("promoted listing") || title.includes("etsy ads")) {
    return { category: "etsy_ads", status: "Matched" };
  }

  // Offsite ads
  if (combined.includes("offsite ad")) {
    return { category: "etsy_offsite_ads_fees", status: "Matched" };
  }

  // Shipping
  if (combined.includes("shipping") || combined.includes("postage")) {
    return { category: "etsy_shipping", status: "Matched" };
  }

  // Share & Save
  if (combined.includes("share") || combined.includes("save")) {
    return { category: "share_save_refunds_credits", status: "Matched" };
  }

  // VAT/Tax
  if (combined.includes("vat") || combined.includes("tax")) {
    return { category: "other_fees", status: "Matched" };
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