/**
 * Collect drill-down items for a given category from the filtered financial data.
 * Mirrors the data source priority used by the financial aggregator so that
 * clicking any line item shows the actual transactions behind that number.
 */

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Fee categories: maps categoryName to data source filters
// Priority: OrderFee → EtsyStatementLine → Fee entity → EtsyLedgerEntry
const FEE_CATEGORY_CONFIG = {
  'etsy_listing_fees': { sections: ['fees'], feeType: 'listing', orderFeeField: 'listing_fees' },
  'etsy_transaction_fees': { sections: ['fees'], feeType: 'transaction', orderFeeField: 'transaction_fees' },
  'etsy_processing_fees': { sections: ['fees'], feeType: 'processing', orderFeeField: 'processing_fees' },
  'other_fees': { sections: ['fees'], feeType: 'other_fee', orderFeeField: 'other_fees' },
  'fee_credits': { sections: ['fees', 'ads'], creditOnly: true, excludeFeeType: 'share_save_credit' },
  'share_save_refunds_credits': { sections: ['fees'], feeType: 'share_save_credit', orderFeeField: 'share_save_credit' },
  'etsy_ads': { sections: ['ads'], feeType: 'etsy_ads' },
  'etsy_offsite_ads_fees': { sections: ['ads'], feeType: 'offsite_ads' },
  'etsy_plus_subscription': { sections: ['ads'], feeType: 'etsy_plus_subscription' },
  'etsy_shipping': { sections: ['shipping'], feeType: 'shipping_label' },
  'other_postage_costs': { sections: ['shipping'], feeType: 'other_postage' },
};

// Legacy Expense entity category name mapping (old → new)
const LEGACY_CATEGORY_MAP = {
  'materials_supplies': ['materials', 'packaging', 'materials_supplies'],
  'tools_equipment': ['tools', 'equipment', 'tools_equipment'],
  'advertising_marketing': ['advertising', 'software', 'advertising_marketing'],
  'office_expenses': ['utilities', 'office_general_expenses', 'office_expenses'],
  'professional_services': ['professional_services'],
  'other': ['other', 'maintenance'],
  'miscellaneous_expenses': ['miscellaneous_expenses'],
  'shipping_postage': ['shipping', 'shipping_postage'],
  'software_subscriptions': ['software', 'software_subscriptions'],
  'gas_mileage': ['gas_mileage'],
  'utilities_cell_phone': ['utilities_cell_phone'],
};

const mapStmtLine = (l) => ({
  date: l.transaction_date,
  description: l.description || l.type || l.fee_type || '',
  vendor: "Etsy",
  payment_source: "Etsy Statement",
  amount: Math.abs(toNum(l.amount)),
});

const mapFeeRecord = (f) => ({
  date: f.transaction_date,
  description: f.description || f.fee_type || '',
  vendor: "Etsy",
  payment_source: "Etsy Fee Record",
  amount: Math.abs(toNum(f.amount)),
});

const mapLedgerEntry = (e) => ({
  date: e.entry_date,
  description: [e.title, e.info].filter(Boolean).join(' - ') || '',
  vendor: "Etsy",
  payment_source: "Etsy Payment Ledger",
  amount: Math.abs(toNum(e.net)),
});

const mapBusinessExpense = (e) => ({
  date: e.date,
  description: e.description || '',
  vendor: e.vendor || '',
  payment_source: e.payment_source || '',
  amount: toNum(e.amount),
});

const mapLegacyExpense = (e) => ({
  date: e.date,
  description: e.description || '',
  vendor: e.vendor || '',
  payment_source: e.payment_method || '',
  amount: toNum(e.amount),
});

export function collectDrillDownItems(categoryName, rawData = {}) {
  const {
    statementLines = [],
    fees = [],
    etsyLedgerEntries = [],
    etsyOrders = [],
    businessExpenses = [],
    expenses = [],
    materialPurchases = [],
    customSales = [],
    transfers = [],
    orderFees = [],
  } = rawData;

  const hasStatementFees = statementLines.some(l => l.section === 'fees' || l.section === 'ads');
  const hasFeeRecords = fees.length > 0;
  const hasOrderFees = orderFees.length > 0;

  // ---- 1) Fee categories (OrderFee → statement lines → Fee entity → ledger) ----
  const feeConfig = FEE_CATEGORY_CONFIG[categoryName];
  if (feeConfig) {
    // Priority 1: OrderFee entity (per-order fee breakdown)
    if (hasOrderFees && feeConfig.orderFeeField) {
      const orderMap = new Map(etsyOrders.map(o => [o.order_id, o]));
      const items = orderFees
        .filter(f => toNum(f[feeConfig.orderFeeField]) !== 0)
        .map(f => {
          const order = orderMap.get(f.order_id);
          return {
            date: order?.sale_date || f.transaction_date || '',
            description: `Order #${f.order_id}${order ? ' - ' + (order.buyer_username || order.buyer_full_name || 'Unknown') : ''}`,
            vendor: "Etsy",
            payment_source: "Order Fee Breakdown",
            amount: Math.abs(toNum(f[feeConfig.orderFeeField])),
          };
        });
      if (items.length > 0) return items;
    }

    // Priority 2: EtsyStatementLine
    if (hasStatementFees) {
      const lines = statementLines.filter(l => {
        if (!feeConfig.sections.includes(l.section)) return false;
        if (feeConfig.creditOnly) {
          return toNum(l.amount) > 0 && l.fee_type !== feeConfig.excludeFeeType;
        }
        return l.fee_type === feeConfig.feeType;
      });
      if (lines.length > 0) return lines.map(mapStmtLine);
    }
    if (hasFeeRecords) {
      const matchingFees = fees.filter(f => {
        if (feeConfig.creditOnly) {
          return toNum(f.amount) > 0 && f.fee_type !== feeConfig.excludeFeeType;
        }
        return f.fee_type === feeConfig.feeType && toNum(f.amount) < 0;
      });
      if (matchingFees.length > 0) return matchingFees.map(mapFeeRecord);
    }
    // Last resort: ledger entries by matched_category
    const ledgerItems = etsyLedgerEntries.filter(e => e.matched_category === categoryName).map(mapLedgerEntry);
    if (ledgerItems.length > 0) return ledgerItems;
    // Fall through to business expenses (handles other_postage_costs fallback)
  }

  // ---- 2) Revenue: Etsy Sales ----
  if (categoryName === 'etsy_sales') {
    return etsyOrders.map(o => ({
      date: o.sale_date,
      description: `Order #${o.order_id} - ${o.buyer_username || o.buyer_full_name || 'Unknown'}`,
      vendor: "Etsy",
      payment_source: o.payment_method || "Etsy",
      amount: toNum(o.order_value) + toNum(o.shipping_charged),
    }));
  }

  // ---- 3) Revenue: Etsy Refunds ----
  if (categoryName === 'etsy_refunds') {
    return etsyOrders
      .filter(o => toNum(o.refund_amount) > 0)
      .map(o => ({
        date: o.sale_date,
        description: `Refund - Order #${o.order_id}`,
        vendor: "Etsy",
        payment_source: "Etsy",
        amount: toNum(o.refund_amount),
      }));
  }

  // ---- 4) Revenue: Custom Sales ----
  if (categoryName === 'custom_sale_a' || categoryName === 'custom_sale_b') {
    const saleType = categoryName === 'custom_sale_a' ? 'A' : 'B';
    return customSales
      .filter(s => s.sale_type === saleType)
      .map(s => ({
        date: s.date,
        description: s.description || s.vendor || 'Custom Sale',
        vendor: s.vendor || '',
        payment_source: s.payment_source || '',
        amount: toNum(s.pre_tax_amount || s.gross_sale),
      }));
  }

  // ---- 5) Cashflow ----
  if (categoryName === 'etsy_deposits') {
    return transfers
      .filter(t => t.type === 'etsy_deposit')
      .map(t => ({
        date: t.date,
        description: t.description || 'Etsy Deposit',
        vendor: "Etsy",
        payment_source: "Bank Transfer",
        amount: toNum(t.amount),
      }));
  }

  if (categoryName === 'owner_transfers') {
    return transfers
      .filter(t => t.type === 'owner_transfer')
      .map(t => ({
        date: t.date,
        description: t.description || 'Owner Transfer',
        vendor: "Owner",
        payment_source: "Bank Transfer",
        amount: toNum(t.amount),
      }));
  }

  // ---- 6) Business Expenses (materials, tools, etc.) ----
  const items = [];

  // MaterialPurchases for materials_supplies
  if (categoryName === 'materials_supplies') {
    items.push(...materialPurchases.map(p => ({
      date: p.purchase_date,
      description: p.material_name || '',
      vendor: p.vendor || '',
      payment_source: p.payment_method || '',
      amount: toNum(p.total_cost),
    })));
  }

  // BusinessExpenses matching this category
  items.push(...businessExpenses
    .filter(e => e.category_name === categoryName)
    .map(mapBusinessExpense));

  // Legacy Expense entity (old category names)
  const legacyCats = LEGACY_CATEGORY_MAP[categoryName] || [categoryName];
  items.push(...expenses
    .filter(e => e.type !== 'return' && legacyCats.includes(e.category))
    .map(mapLegacyExpense));

  return items;
}