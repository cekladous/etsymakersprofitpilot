/**
 * Shared expense category definitions for consistent labeling across the app
 */

export const BUSINESS_EXPENSE_CATEGORIES = [
  { value: "materials_supplies", label: "Materials & Supplies", group: "product" },
  { value: "packaging_materials", label: "Packaging Materials", group: "product" },
  { value: "tools_equipment", label: "Tools & Equipment", group: "product" },
  { value: "shipping_postage", label: "Shipping & Postage", group: "business" },
  { value: "advertising_marketing", label: "Advertising & Marketing (non-Etsy)", group: "business" },
  { value: "office_general_expenses", label: "Office / General Expenses", group: "business" },
  { value: "gas_mileage", label: "Gas / Mileage", group: "business" },
  { value: "utilities_cell_phone", label: "Utilities / Cell Phone", group: "business" },
  { value: "software_subscriptions", label: "Software / Subscriptions", group: "business" },
  { value: "professional_services", label: "Professional Services", group: "business" },
  { value: "payment_processing_fees", label: "Payment Processing Fees", group: "business" },
  { value: "insurance", label: "Insurance", group: "business" },
  { value: "rent", label: "Rent / Lease", group: "business" },
  { value: "other", label: "Other Business Expenses", group: "business" },
  { value: "miscellaneous_expenses", label: "Miscellaneous", group: "business" },
];

export const ETSY_FEE_CATEGORIES = [
  { value: "etsy_listing_fees", label: "Listing Fees", group: "etsy_fees" },
  { value: "etsy_transaction_fees", label: "Transaction Fees", group: "etsy_fees" },
  { value: "etsy_processing_fees", label: "Processing Fees", group: "etsy_fees" },
  { value: "etsy_ads", label: "Advertising Fees", group: "etsy_fees" },
  { value: "etsy_offsite_ads_fees", label: "Offsite Ads", group: "etsy_fees" },
  { value: "etsy_refund_return_fees", label: "Refund/Return Fees", group: "etsy_fees" },
  { value: "other_fees", label: "Other Fees", group: "etsy_fees" },
];

export const FEE_CATEGORIES = [
  { value: "share_save_refunds_credits", label: "Share & Save Credits", group: "fees", isCredit: true },
  { value: "etsy_shipping", label: "Shipping Labels (Etsy)", group: "shipping" },
  { value: "other_postage_costs", label: "Other Postage", group: "shipping" },
  { value: "etsy_plus_subscription", label: "Etsy Plus Subscription", group: "fees" },
  { value: "fee_credits", label: "Fee Credits", group: "fees", isCredit: true },
];

export const ALL_EXPENSE_CATEGORIES = [
  ...BUSINESS_EXPENSE_CATEGORIES,
  ...ETSY_FEE_CATEGORIES,
  ...FEE_CATEGORIES,
];

export const getCategoryLabel = (categoryValue) => {
  const category = ALL_EXPENSE_CATEGORIES.find(c => c.value === categoryValue);
  return category?.label || categoryValue;
};

export const getCategoryGroup = (categoryValue) => {
  const category = ALL_EXPENSE_CATEGORIES.find(c => c.value === categoryValue);
  return category?.group || "business";
};

export const CATEGORY_COLORS = {
  materials_supplies: "bg-blue-100 text-blue-700",
  packaging_materials: "bg-teal-100 text-teal-700",
  tools_equipment: "bg-amber-100 text-amber-700",
  shipping_postage: "bg-yellow-100 text-yellow-700",
  advertising_marketing: "bg-pink-100 text-pink-700",
  office_general_expenses: "bg-emerald-100 text-emerald-700",
  office_expenses: "bg-emerald-100 text-emerald-700",
  gas_mileage: "bg-cyan-100 text-cyan-700",
  utilities_cell_phone: "bg-indigo-100 text-indigo-700",
  software_subscriptions: "bg-purple-100 text-purple-700",
  professional_services: "bg-violet-100 text-violet-700",
  payment_processing_fees: "bg-rose-100 text-rose-700",
  insurance: "bg-lime-100 text-lime-700",
  rent: "bg-fuchsia-100 text-fuchsia-700",
  other: "bg-stone-100 text-stone-600",
  miscellaneous_expenses: "bg-stone-200 text-stone-700",
  etsy_listing_fees: "bg-orange-100 text-orange-700",
  etsy_transaction_fees: "bg-orange-200 text-orange-800",
  etsy_processing_fees: "bg-orange-100 text-orange-700",
  share_save_refunds_credits: "bg-emerald-100 text-emerald-700",
  other_fees: "bg-orange-200 text-orange-800",
  etsy_ads: "bg-orange-100 text-orange-700",
  etsy_offsite_ads_fees: "bg-orange-200 text-orange-800",
  etsy_refund_return_fees: "bg-rose-100 text-rose-700",
  etsy_shipping: "bg-yellow-100 text-yellow-700",
  other_postage_costs: "bg-yellow-200 text-yellow-800",
  etsy_plus_subscription: "bg-orange-100 text-orange-700",
  fee_credits: "bg-emerald-100 text-emerald-700",
};

/**
 * Legacy structure for BudgetTab compatibility
 */
export const EXPENSE_CATEGORY_GROUPS = {
  selling_expenses: {
    label: "Selling Expenses",
    color: "bg-cyan-50",
    categories: [
      { name: "etsy_listing_fees", label: "Etsy Listing Fees" },
      { name: "etsy_transaction_fees", label: "Etsy Transaction Fees" },
      { name: "etsy_processing_fees", label: "Etsy Processing Fees" },
      { name: "share_save_refunds_credits", label: "Share & Save Credits" },
      { name: "other_fees", label: "Other Fees" },
      { name: "etsy_ads", label: "Etsy Ads" },
      { name: "etsy_offsite_ads_fees", label: "Offsite Ads" },
      { name: "etsy_shipping", label: "Shipping Labels" },
      { name: "other_postage_costs", label: "Other Postage" },
    ],
  },
  product_expenses: {
    label: "Product Expenses",
    color: "bg-pink-50",
    categories: [
      { name: "materials_supplies", label: "Materials & Supplies" },
      { name: "packaging_materials", label: "Packaging Materials" },
      { name: "tools_equipment", label: "Tools & Equipment" },
    ],
  },
  business_expenses: {
    label: "Business Expenses",
    color: "bg-purple-50",
    categories: [
      { name: "shipping_postage", label: "Shipping & Postage" },
      { name: "advertising_marketing", label: "Advertising & Marketing" },
      { name: "office_expenses", label: "Office Expenses" },
      { name: "professional_services", label: "Professional Services" },
      { name: "payment_processing_fees", label: "Payment Processing Fees" },
      { name: "insurance", label: "Insurance" },
      { name: "rent", label: "Rent / Lease" },
      { name: "other", label: "Other" },
      { name: "miscellaneous_expenses", label: "Miscellaneous" },
    ],
  },
};