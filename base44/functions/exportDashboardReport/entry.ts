import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ==================== SERVER-SIDE FINANCIAL COMPUTATION ====================
// SECURITY: All financial figures are computed from the database — never trusted
// from the client request body. This prevents fabrication of report data.

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Parse a yyyy-MM-dd date string as a local calendar date at midnight
// (avoids UTC timezone shift that causes month-boundary errors)
const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const isSquareInPerson = (order) => {
  if (!order) return false;
  const ot = String(order.order_type || '').toLowerCase();
  const pt = String(order.payment_type || '').toLowerCase();
  return ot.includes('inperson') || ot.includes('square') ||
         pt.includes('square') || pt.includes('inperson');
};

const filterByDate = (items, dateField, start, end) => {
  return (items || []).filter(item => {
    const d = parseDate(item[dateField]);
    if (!d) return false;
    return d >= start && d <= end;
  });
};

// Advance a date by a recurring frequency
const advanceByFreq = (date, freq) => {
  const d = new Date(date);
  switch (freq) {
    case 'Weekly': d.setDate(d.getDate() + 7); break;
    case 'Monthly': d.setMonth(d.getMonth() + 1); break;
    case 'Quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'Annually': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
};

// Expand recurring expenses into occurrence dates within the period
const getRecurringOccurrences = (expense, periodStart, periodEnd) => {
  const occurrences = [];
  const expenseDate = parseDate(expense.date);
  if (!expenseDate || expenseDate > periodEnd) return occurrences;
  let current = new Date(expenseDate);
  let iterations = 0;
  while (current <= periodEnd && iterations < 1000) {
    if (current >= periodStart) {
      occurrences.push(current.toISOString().split('T')[0]);
    }
    current = advanceByFreq(current, expense.recurring_frequency);
    iterations++;
  }
  return occurrences;
};

/**
 * Compute all financial metrics server-side from database records.
 * Mirrors the logic in src/components/shared/financialAggregator.jsx
 * but only computes the fields needed for report rendering.
 */
async function computeFinancialData(base44, userId, start, end) {
  // Fetch all user-owned entities (RLS scopes these automatically, but we
  // pass owner_user_id explicitly for clarity)
  const [
    etsyOrders, customSales, businessExpenses, materialPurchases,
    orderFees, etsyStatementLines, etsyStatementImports,
    fees, etsyLedgerEntries, legacyExpenses
  ] = await Promise.all([
    base44.entities.EtsyOrder.filter({ owner_user_id: userId }, '-sale_date', 1000),
    base44.entities.CustomSale.filter({ owner_user_id: userId }, '-date', 1000),
    base44.entities.BusinessExpense.filter({ owner_user_id: userId }, '-date', 1000),
    base44.entities.MaterialPurchase.filter({ owner_user_id: userId }, '-purchase_date', 1000),
    base44.entities.OrderFee.filter({ owner_user_id: userId }),
    base44.entities.EtsyStatementLine.filter({ owner_user_id: userId }, '-transaction_date', 5000),
    base44.entities.EtsyStatementImport.filter({ owner_user_id: userId }),
    base44.entities.Fee.filter({ owner_user_id: userId }, '-transaction_date', 5000),
    base44.entities.EtsyLedgerEntry.filter({ owner_user_id: userId }, '-entry_date', 5000),
    base44.entities.Expense.filter({ owner_user_id: userId }, '-date', 5000),
  ]);

  // ==================== DATE FILTER ====================
  const periodEtsyOrders = filterByDate(etsyOrders, 'sale_date', start, end);
  const periodCustomSales = filterByDate(customSales, 'date', start, end);
  const periodMaterialPurchases = filterByDate(materialPurchases, 'purchase_date', start, end);
  const periodLegacyExpenses = filterByDate(legacyExpenses, 'date', start, end)
    .filter(e => e.type !== 'return');

  // Business expenses: include date-filtered + expanded recurring
  const periodBusinessExpenses = [];
  for (const e of businessExpenses) {
    if (e.is_recurring && e.recurring_frequency) {
      const occurrences = getRecurringOccurrences(e, start, end);
      for (const occDate of occurrences) {
        periodBusinessExpenses.push({ ...e, date: occDate });
      }
    } else {
      const d = parseDate(e.date);
      if (d && d >= start && d <= end) {
        periodBusinessExpenses.push(e);
      }
    }
  }

  // Statement lines: filter by date + exclude replaced imports
  const activeImportIds = new Set(
    etsyStatementImports.filter(imp => imp.status !== 'replaced').map(imp => imp.id)
  );
  const periodStatementLines = filterByDate(etsyStatementLines, 'transaction_date', start, end)
    .filter(line => line.import_id && activeImportIds.has(line.import_id));

  const periodFees = filterByDate(fees, 'transaction_date', start, end)
    .filter(fee => !fee.import_id || activeImportIds.has(fee.import_id));

  const periodLedgerEntries = filterByDate(etsyLedgerEntries, 'entry_date', start, end);

  // ==================== CHANNEL SPLIT ====================
  const etsyOnlineOrders = periodEtsyOrders.filter(o => !isSquareInPerson(o));
  const squareInPersonOrders = periodEtsyOrders.filter(o => isSquareInPerson(o));

  // ==================== REVENUE ====================
  // Etsy online sales: order_total - sales_tax - CO retail delivery fee
  const etsySalesFromOrders = etsyOnlineOrders.reduce((sum, o) => {
    const gross = toNum(o.order_total);
    const tax = toNum(o.sales_tax);
    const expected = toNum(o.order_value) + toNum(o.shipping_charged) + tax - toNum(o.discount_amount);
    const coFee = Math.max(0, toNum(o.order_total) - expected);
    return sum + gross - tax - coFee;
  }, 0);

  // Square in-person revenue
  const squareInPersonRevenue = squareInPersonOrders.reduce((sum, o) => {
    const gross = toNum(o.order_total) - toNum(o.refund_amount);
    const tax = toNum(o.sales_tax);
    const expected = toNum(o.order_value) + toNum(o.shipping_charged) + tax - toNum(o.discount_amount);
    const coFee = Math.max(0, toNum(o.order_total) - expected);
    return sum + gross - tax - coFee;
  }, 0);

  // Sales from statement lines not linked to orders
  const etsySalesFromStmtLines = periodStatementLines
    .filter(line => line.category === 'sale' && !line.source_etsy_order_id)
    .reduce((sum, line) => sum + toNum(line.amount), 0);

  const etsySales = etsySalesFromOrders + etsySalesFromStmtLines;
  const etsyRefunds = etsyOnlineOrders.reduce((sum, o) => sum + toNum(o.refund_amount), 0);

  // Custom sales A/B
  const customSaleA = periodCustomSales
    .filter(s => s.sale_type === 'A')
    .reduce((sum, s) => sum + toNum(s.pre_tax_amount || s.gross_sale), 0);
  const customSaleB = periodCustomSales
    .filter(s => s.sale_type === 'B')
    .reduce((sum, s) => sum + toNum(s.pre_tax_amount || s.gross_sale), 0);
  const customSalesTaxCollected = periodCustomSales.reduce((sum, s) =>
    sum + toNum(s.sales_tax_collected), 0);

  const totalRevenue = (etsySales - etsyRefunds) + squareInPersonRevenue + customSaleA + customSaleB;

  // ==================== SELLING EXPENSES ====================
  const allPeriodOrderIds = new Set(etsyOnlineOrders.map(o => o.order_id));
  const periodOrderFees = orderFees.filter(f => allPeriodOrderIds.has(f.order_id));
  const hasOrderFees = periodOrderFees.length > 0;

  const stmtFeeLines = periodStatementLines.filter(l => l.section === 'fees');
  const stmtAdsLines = periodStatementLines.filter(l => l.section === 'ads');
  const hasStatementFees = stmtFeeLines.length > 0 || stmtAdsLines.length > 0;
  const hasFeeRecords = periodFees.length > 0;

  const sumGrossFees = (feeType) => periodFees
    .filter(f => f.fee_type === feeType && toNum(f.amount) < 0)
    .reduce((sum, f) => sum + Math.abs(toNum(f.amount)), 0);

  const sumFeeCredits = (feeType) => periodFees
    .filter(f => f.fee_type === feeType && toNum(f.amount) > 0)
    .reduce((sum, f) => sum + toNum(f.amount), 0);

  // 1) Listing fees
  const etsyListingFees = hasOrderFees
    ? periodOrderFees.reduce((sum, f) => sum + toNum(f.listing_fees), 0)
    : hasStatementFees
    ? stmtFeeLines.filter(l => l.fee_type === 'listing').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? sumGrossFees('listing') : 0;

  // 2) Transaction fees
  const etsyTransactionFees = hasOrderFees
    ? periodOrderFees.reduce((sum, f) => sum + toNum(f.transaction_fees), 0)
    : hasStatementFees
    ? stmtFeeLines.filter(l => l.fee_type === 'transaction').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? sumGrossFees('transaction') : 0;

  // 3) Processing fees
  const etsyProcessingFees = hasOrderFees
    ? periodOrderFees.reduce((sum, f) => sum + toNum(f.processing_fees), 0)
    : hasStatementFees
    ? stmtFeeLines.filter(l => l.fee_type === 'processing').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? sumGrossFees('processing') : 0;

  // 4) Other fees
  const otherFees = hasOrderFees
    ? periodOrderFees.reduce((sum, f) => sum + toNum(f.other_fees), 0)
    : hasStatementFees
    ? stmtFeeLines.filter(l => l.fee_type === 'other_fee').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? sumGrossFees('other_fee') : 0;

  // 5) Share & Save credits (negative — reduces fees)
  const shareSaveRefunds = hasOrderFees
    ? -periodOrderFees.reduce((sum, f) => sum + toNum(f.share_save_credit), 0)
    : hasStatementFees
    ? stmtFeeLines.filter(l => l.fee_type === 'share_save_credit').reduce((sum, l) => sum - Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? -sumFeeCredits('share_save_credit') : 0;

  // 6) Fee credits (positive amounts, excluding share_save_credit)
  const feeCredits = hasStatementFees
    ? [...stmtFeeLines, ...stmtAdsLines].filter(l => toNum(l.amount) > 0 && l.fee_type !== 'share_save_credit')
      .reduce((sum, l) => sum + toNum(l.amount), 0)
    : hasFeeRecords
    ? periodFees.filter(f => toNum(f.amount) > 0 && f.fee_type !== 'share_save_credit')
      .reduce((sum, f) => sum + toNum(f.amount), 0)
    : 0;

  // 7) Etsy Ads
  const etsyAds = hasStatementFees
    ? stmtAdsLines.filter(l => l.fee_type === 'etsy_ads').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? sumGrossFees('etsy_ads') : 0;

  // 8) Offsite Ads
  const etsyOffsiteAds = hasStatementFees
    ? stmtAdsLines.filter(l => l.fee_type === 'offsite_ads').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? sumGrossFees('offsite_ads') : 0;

  // 9) Etsy Plus Subscription
  const etsyPlusSubscription = stmtAdsLines
    .filter(l => l.fee_type === 'etsy_plus_subscription')
    .reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0);

  // 10) Etsy Shipping (labels)
  const stmtShippingLines = periodStatementLines.filter(l => l.section === 'shipping');
  const etsyShipping = hasStatementFees
    ? stmtShippingLines.filter(l => l.fee_type === 'shipping_label').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : hasFeeRecords ? sumGrossFees('shipping_label') : 0;

  // 11) Other postage
  const otherPostage = hasStatementFees
    ? stmtShippingLines.filter(l => l.fee_type === 'other_postage').reduce((sum, l) => sum + Math.abs(toNum(l.amount)), 0)
    : periodBusinessExpenses.filter(e => e.category_name === 'other_postage_costs')
      .reduce((sum, e) => sum + toNum(e.amount), 0);

  const totalEtsyFees = toNum(etsyListingFees + etsyTransactionFees + etsyProcessingFees + shareSaveRefunds + otherFees - feeCredits);
  const totalMarketing = toNum(etsyAds + etsyOffsiteAds + etsyPlusSubscription);
  const totalSellingExpenses = toNum(totalEtsyFees + totalMarketing + etsyShipping + otherPostage);

  // ==================== PRODUCT EXPENSES ====================
  const materialsCost = periodMaterialPurchases.reduce((sum, p) => sum + toNum(p.total_cost), 0);
  const materialsExpense = periodBusinessExpenses
    .filter(e => e.category_name === 'materials_supplies')
    .reduce((sum, e) => sum + toNum(e.amount), 0);
  const legacyMaterials = periodLegacyExpenses
    .filter(e => ['materials', 'packaging', 'materials_supplies'].includes(e.category))
    .reduce((sum, e) => sum + toNum(e.amount), 0);
  const totalMaterialsSupplies = toNum(materialsCost + materialsExpense + legacyMaterials);

  const toolsEquipmentFromBE = periodBusinessExpenses
    .filter(e => e.category_name === 'tools_equipment')
    .reduce((sum, e) => sum + toNum(e.amount), 0);
  const legacyTools = periodLegacyExpenses
    .filter(e => ['tools', 'equipment', 'tools_equipment'].includes(e.category))
    .reduce((sum, e) => sum + toNum(e.amount), 0);
  const toolsEquipment = toNum(toolsEquipmentFromBE + legacyTools);

  const packagingMaterialsFromBE = periodBusinessExpenses
    .filter(e => e.category_name === 'packaging_materials')
    .reduce((sum, e) => sum + toNum(e.amount), 0);
  const legacyPackaging = periodLegacyExpenses
    .filter(e => ['packaging', 'packaging_materials'].includes(e.category))
    .reduce((sum, e) => sum + toNum(e.amount), 0);
  const packagingMaterials = toNum(packagingMaterialsFromBE + legacyPackaging);

  const totalProductExpenses = toNum(totalMaterialsSupplies + toolsEquipment + packagingMaterials);

  // ==================== BUSINESS EXPENSES ====================
  const advertisingMarketing = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'advertising_marketing').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['advertising', 'software', 'advertising_marketing'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const officeExpenses = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'office_general_expenses').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['utilities', 'office_general_expenses', 'office_expenses'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const gasMileage = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'gas_mileage').reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const utilitiesCellPhone = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'utilities_cell_phone').reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const professionalServices = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'professional_services').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['professional_services'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const otherBusinessExpenses = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'other').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['other', 'maintenance', 'shipping'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const miscellaneousExpenses = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'miscellaneous_expenses').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['miscellaneous_expenses'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const shippingPostage = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'shipping_postage').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['shipping', 'shipping_postage'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const softwareSubscriptions = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'software_subscriptions').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['software', 'software_subscriptions'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const etsyFeesFromBE = toNum(
    periodBusinessExpenses.filter(e => e.category_name === 'other_fees').reduce((sum, e) => sum + toNum(e.amount), 0) +
    periodLegacyExpenses.filter(e => ['other_fees'].includes(e.category)).reduce((sum, e) => sum + toNum(e.amount), 0)
  );
  const insurance = toNum(periodBusinessExpenses.filter(e => e.category_name === 'insurance').reduce((sum, e) => sum + toNum(e.amount), 0));
  const rent = toNum(periodBusinessExpenses.filter(e => e.category_name === 'rent').reduce((sum, e) => sum + toNum(e.amount), 0));
  const paymentProcessingFees = toNum(periodBusinessExpenses.filter(e => e.category_name === 'payment_processing_fees').reduce((sum, e) => sum + toNum(e.amount), 0));

  const totalBusinessExpenses = toNum(
    advertisingMarketing + officeExpenses + gasMileage + utilitiesCellPhone +
    professionalServices + otherBusinessExpenses + miscellaneousExpenses +
    shippingPostage + softwareSubscriptions + etsyFeesFromBE +
    insurance + rent + paymentProcessingFees
  );

  // ==================== TOTALS ====================
  const totalExpenses = toNum(totalSellingExpenses + totalProductExpenses + totalBusinessExpenses);
  const netProfit = toNum(totalRevenue - totalExpenses);
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
    revenue: {
      netEtsySales: etsySales - etsyRefunds,
      etsyRefunds,
      customSaleA,
      customSaleB,
      customSalesTaxCollected,
    },
    sellingExpenses: {
      total: totalSellingExpenses,
      etsyListingFees,
      etsyTransactionFees,
      etsyProcessingFees,
      etsyAds,
    },
    productExpenses: {
      total: totalProductExpenses,
      materialsSupplies: totalMaterialsSupplies,
      toolsEquipment,
    },
    businessExpenses: {
      total: totalBusinessExpenses,
      advertisingMarketing,
      officeExpenses,
      gasMileage,
      utilitiesCellPhone,
      professionalServices,
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    // SECURITY: Only accept the date range and format from the client.
    // All financial figures are computed server-side from the database.
    const { format: exportFormat = 'pdf', periodStart, periodEnd, periodLabel } = payload;

    if (!periodStart || !periodEnd) {
      return Response.json({ error: 'Missing required date range (periodStart, periodEnd)' }, { status: 400 });
    }

    const start = parseDate(periodStart);
    const end = parseDate(periodEnd);
    if (!start || !end) {
      return Response.json({ error: 'Invalid date format for periodStart or periodEnd' }, { status: 400 });
    }

    // Fetch settings from the database (prevents business_name spoofing)
    const userSettings = await base44.entities.Settings.filter({
      owner_user_id: user.id
    });
    const settings = userSettings[0] || { business_name: '' };

    // Compute all financial data server-side — never trust client-supplied figures
    const financialData = await computeFinancialData(base44, user.id, start, end);

    if (exportFormat === 'pdf') {
      const { jsPDF } = await import('npm:jspdf@4.0.0');
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Helper to add section
      const addSection = (title) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFontSize(14);
        doc.setTextColor(20, 20, 20);
        doc.text(title, margin, yPos);
        yPos += 8;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
        yPos += 4;
      };

      const addText = (label, value, bold = false) => {
        if (yPos > pageHeight - 10) {
          doc.addPage();
          yPos = margin;
        }
        if (bold) doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(`${label}:`, margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), pageWidth - margin - 50, yPos, { align: 'right' });
        yPos += 6;
      };

      // Header
      doc.setFontSize(16);
      doc.setTextColor(10, 10, 10);
      doc.text(`${settings.business_name || 'Business'} - Financial Report`, margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Period: ${periodLabel} | Generated: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 10;

      // KPI Section
      addSection('Key Performance Indicators');
      
      const totalRevenue = financialData.totalRevenue || 0;
      const totalExpenses = financialData.totalExpenses || 0;
      const netProfit = financialData.netProfit || 0;
      const profitMargin = financialData.profitMargin || 0;

      addText('Total Revenue', `$${totalRevenue.toFixed(2)}`, true);
      addText('Total Expenses', `$${totalExpenses.toFixed(2)}`);
      addText('Net Profit', `$${netProfit.toFixed(2)}`, true);
      addText('Profit Margin', `${profitMargin.toFixed(1)}%`);

      // Revenue Breakdown
      addSection('Revenue Breakdown');
      addText('Etsy Sales (Net)', `$${(financialData.revenue?.netEtsySales || 0).toFixed(2)}`);
      if (financialData.revenue?.etsyRefunds > 0) {
        addText('Etsy Refunds', `−$${financialData.revenue.etsyRefunds.toFixed(2)}`);
      }
      addText('Custom Sales A', `$${(financialData.revenue?.customSaleA || 0).toFixed(2)}`);
      addText('Custom Sales B', `$${(financialData.revenue?.customSaleB || 0).toFixed(2)}`);
      if (financialData.revenue?.customSalesTaxCollected > 0) {
        addText('Sales Tax Collected', `$${financialData.revenue.customSalesTaxCollected.toFixed(2)}`);
      }

      // Expense Breakdown
      addSection('Expense Breakdown');
      
      // Selling Expenses
      if (financialData.sellingExpenses?.total > 0) {
        doc.setFont(undefined, 'bold');
        addText('Selling Expenses', `$${financialData.sellingExpenses.total.toFixed(2)}`);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (financialData.sellingExpenses.etsyListingFees > 0) {
          addText('  • Listing Fees', `$${financialData.sellingExpenses.etsyListingFees.toFixed(2)}`);
        }
        if (financialData.sellingExpenses.etsyTransactionFees > 0) {
          addText('  • Transaction Fees', `$${financialData.sellingExpenses.etsyTransactionFees.toFixed(2)}`);
        }
        if (financialData.sellingExpenses.etsyProcessingFees > 0) {
          addText('  • Processing Fees', `$${financialData.sellingExpenses.etsyProcessingFees.toFixed(2)}`);
        }
        if (financialData.sellingExpenses.etsyAds > 0) {
          addText('  • Etsy Ads', `$${financialData.sellingExpenses.etsyAds.toFixed(2)}`);
        }
      }

      // Product Expenses
      if (financialData.productExpenses?.total > 0) {
        doc.setFont(undefined, 'bold');
        addText('Product Expenses', `$${financialData.productExpenses.total.toFixed(2)}`);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (financialData.productExpenses.materialsSupplies > 0) {
          addText('  • Materials & Supplies', `$${financialData.productExpenses.materialsSupplies.toFixed(2)}`);
        }
        if (financialData.productExpenses.toolsEquipment > 0) {
          addText('  • Tools & Equipment', `$${financialData.productExpenses.toolsEquipment.toFixed(2)}`);
        }
      }

      // Business Expenses
      if (financialData.businessExpenses?.total > 0) {
        doc.setFont(undefined, 'bold');
        addText('Business Expenses', `$${financialData.businessExpenses.total.toFixed(2)}`);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (financialData.businessExpenses.advertisingMarketing > 0) {
          addText('  • Advertising & Marketing', `$${financialData.businessExpenses.advertisingMarketing.toFixed(2)}`);
        }
        if (financialData.businessExpenses.officeExpenses > 0) {
          addText('  • Office Expenses', `$${financialData.businessExpenses.officeExpenses.toFixed(2)}`);
        }
        if (financialData.businessExpenses.gasMileage > 0) {
          addText('  • Gas / Mileage', `$${financialData.businessExpenses.gasMileage.toFixed(2)}`);
        }
        if (financialData.businessExpenses.utilitiesCellPhone > 0) {
          addText('  • Utilities / Cell Phone', `$${financialData.businessExpenses.utilitiesCellPhone.toFixed(2)}`);
        }
        if (financialData.businessExpenses.professionalServices > 0) {
          addText('  • Professional Services', `$${financialData.businessExpenses.professionalServices.toFixed(2)}`);
        }
      }

      // Summary
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
      }
      addSection('Summary');
      doc.setFont(undefined, 'bold');
      addText('Total Revenue', `$${totalRevenue.toFixed(2)}`, true);
      doc.setFont(undefined, 'normal');
      addText('Total Expenses', `$${totalExpenses.toFixed(2)}`);
      doc.setFont(undefined, 'bold');
      addText('Net Profit', `$${netProfit.toFixed(2)}`, true);
      addText('Profit Margin', `${profitMargin.toFixed(1)}%`);

      const pdfBytes = doc.output('arraybuffer');
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="report_${periodLabel.replace(/\s+/g, '_')}.pdf"`
        }
      });
    } else if (exportFormat === 'xlsx') {
      const { utils, write } = await import('npm:xlsx@0.18.5');

      const sheets = {};

      // Summary sheet
      const summaryData = [
        ['Financial Report', '', '', ''],
        ['Business', settings.business_name || 'N/A'],
        ['Period', periodLabel],
        ['Generated', new Date().toLocaleDateString()],
        ['', '', '', ''],
        ['KEY METRICS', '', '', ''],
        ['Total Revenue', financialData.totalRevenue || 0],
        ['Total Expenses', financialData.totalExpenses || 0],
        ['Net Profit', financialData.netProfit || 0],
        ['Profit Margin %', financialData.profitMargin || 0],
      ];
      sheets.Summary = utils.aoa_to_sheet(summaryData);

      // Revenue sheet
      const revenueData = [
        ['Revenue Breakdown'],
        ['Category', 'Amount'],
        ['Etsy Sales (Net)', financialData.revenue?.netEtsySales || 0],
        ['Etsy Refunds', -(financialData.revenue?.etsyRefunds || 0)],
        ['Custom Sales A', financialData.revenue?.customSaleA || 0],
        ['Custom Sales B', financialData.revenue?.customSaleB || 0],
        ['Sales Tax (Reference)', financialData.revenue?.customSalesTaxCollected || 0],
        ['TOTAL REVENUE', financialData.totalRevenue || 0],
      ];
      sheets.Revenue = utils.aoa_to_sheet(revenueData);

      // Expenses sheet
      const expenseData = [
        ['Expense Breakdown'],
        ['Category', 'Amount'],
      ];

      if (financialData.sellingExpenses?.total > 0) {
        expenseData.push(['SELLING EXPENSES', financialData.sellingExpenses.total]);
        if (financialData.sellingExpenses.etsyListingFees > 0) {
          expenseData.push(['  Listing Fees', financialData.sellingExpenses.etsyListingFees]);
        }
        if (financialData.sellingExpenses.etsyTransactionFees > 0) {
          expenseData.push(['  Transaction Fees', financialData.sellingExpenses.etsyTransactionFees]);
        }
        if (financialData.sellingExpenses.etsyProcessingFees > 0) {
          expenseData.push(['  Processing Fees', financialData.sellingExpenses.etsyProcessingFees]);
        }
        if (financialData.sellingExpenses.etsyAds > 0) {
          expenseData.push(['  Etsy Ads', financialData.sellingExpenses.etsyAds]);
        }
      }

      if (financialData.productExpenses?.total > 0) {
        expenseData.push(['PRODUCT EXPENSES', financialData.productExpenses.total]);
        if (financialData.productExpenses.materialsSupplies > 0) {
          expenseData.push(['  Materials & Supplies', financialData.productExpenses.materialsSupplies]);
        }
        if (financialData.productExpenses.toolsEquipment > 0) {
          expenseData.push(['  Tools & Equipment', financialData.productExpenses.toolsEquipment]);
        }
      }

      if (financialData.businessExpenses?.total > 0) {
        expenseData.push(['BUSINESS EXPENSES', financialData.businessExpenses.total]);
        if (financialData.businessExpenses.advertisingMarketing > 0) {
          expenseData.push(['  Advertising & Marketing', financialData.businessExpenses.advertisingMarketing]);
        }
        if (financialData.businessExpenses.officeExpenses > 0) {
          expenseData.push(['  Office Expenses', financialData.businessExpenses.officeExpenses]);
        }
        if (financialData.businessExpenses.gasMileage > 0) {
          expenseData.push(['  Gas / Mileage', financialData.businessExpenses.gasMileage]);
        }
        if (financialData.businessExpenses.utilitiesCellPhone > 0) {
          expenseData.push(['  Utilities / Cell Phone', financialData.businessExpenses.utilitiesCellPhone]);
        }
        if (financialData.businessExpenses.professionalServices > 0) {
          expenseData.push(['  Professional Services', financialData.businessExpenses.professionalServices]);
        }
      }

      expenseData.push(['TOTAL EXPENSES', financialData.totalExpenses || 0]);
      sheets.Expenses = utils.aoa_to_sheet(expenseData);

      const workbook = { Sheets: sheets, SheetNames: ['Summary', 'Revenue', 'Expenses'] };
      const buffer = write(workbook, { bookType: 'xlsx', type: 'array' });

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="report_${periodLabel.replace(/\s+/g, '_')}.xlsx"`
        }
      });
    }

    return Response.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});