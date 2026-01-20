/**
 * Dynamic category mappings derived from BusinessExpense schema
 * Single source of truth for all business expense categories
 */

// Direct mapping from schema category_name to display info
// This is the ONLY place to update when adding new categories
const CATEGORY_MAPPINGS = {
  // Product Expenses
  materials_supplies: { label: "Materials & Supplies", key: "materialsSupplies", section: "product" },
  packaging_materials: { label: "Packaging Materials", key: "packagingMaterials", section: "product" },
  tools_equipment: { label: "Tools & Equipment", key: "toolsEquipment", section: "product" },
  
  // Business Expenses
  advertising_marketing: { label: "Advertising & Marketing", key: "advertisingMarketing", section: "business" },
  office_general_expenses: { label: "Office Expenses", key: "officeExpenses", section: "business" },
  gas_mileage: { label: "Gas & Mileage", key: "gasMileage", section: "business" },
  utilities_cell_phone: { label: "Utilities & Cell Phone", key: "utilitiesCellPhone", section: "business" },
  software_subscriptions: { label: "Software Subscriptions", key: "softwareSubscriptions", section: "business" },
  professional_services: { label: "Professional Services", key: "professionalServices", section: "business" },
  other: { label: "Other", key: "other", section: "business" },
  miscellaneous_expenses: { label: "Miscellaneous", key: "miscellaneous", section: "business" },
  
  // Selling Expenses (Etsy Fees)
  etsy_listing_fees: { label: "Listing Fees", key: "etsyListingFees", section: "fees" },
  etsy_transaction_fees: { label: "Transaction Fees", key: "etsyTransactionFees", section: "fees" },
  etsy_processing_fees: { label: "Processing Fees", key: "etsyProcessingFees", section: "fees" },
  share_save_refunds_credits: { label: "Share & Save Credits", key: "shareSaveRefunds", section: "fees" },
  other_fees: { label: "Other Fees", key: "otherFees", section: "fees" },
  etsy_ads: { label: "Etsy Ads", key: "etsyAds", section: "fees" },
  etsy_offsite_ads_fees: { label: "Offsite Ads", key: "etsyOffsiteAds", section: "fees" },
  etsy_shipping: { label: "Shipping Labels", key: "etsyShipping", section: "fees" },
  other_postage_costs: { label: "Other Postage", key: "otherPostage", section: "fees" },
};

/**
 * Get all business expense categories (excludes fees by default)
 */
export function getBusinessExpenseCategories() {
  return Object.entries(CATEGORY_MAPPINGS)
    .filter(([_, info]) => info.section !== "fees")
    .map(([schemaName, info]) => ({ ...info, schemaName }));
}

/**
 * Get all fee categories
 */
export function getFeeCategories() {
  return Object.entries(CATEGORY_MAPPINGS)
    .filter(([_, info]) => info.section === "fees")
    .map(([schemaName, info]) => ({ ...info, schemaName }));
}

/**
 * Convert aggregateFinancials key (camelCase) to schema name (snake_case)
 */
export function getSchemaNameForKey(key) {
  for (const [schemaName, info] of Object.entries(CATEGORY_MAPPINGS)) {
    if (info.key === key) return schemaName;
  }
  return key;
}

/**
 * Get display info for a category key
 */
export function getCategoryInfo(key) {
  for (const info of Object.values(CATEGORY_MAPPINGS)) {
    if (info.key === key) return info;
  }
  return null;
}