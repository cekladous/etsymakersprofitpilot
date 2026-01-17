/**
 * Shared expense category definitions for consistent labeling across the app
 */

export const BUSINESS_EXPENSE_CATEGORIES = [
  { value: "materials_supplies", label: "Materials & Supplies", group: "product" },
  { value: "tools_equipment", label: "Tools & Equipment", group: "product" },
  { value: "advertising_marketing", label: "Advertising & Marketing", group: "business" },
  { value: "office_expenses", label: "Office Expenses", group: "business" },
  { value: "professional_services", label: "Professional Services", group: "business" },
  { value: "other", label: "Other", group: "business" },
  { value: "miscellaneous_expenses", label: "Miscellaneous", group: "business" },
];

export const FEE_CATEGORIES = [
  { value: "etsy_listing_fees", label: "Listing Fees", group: "fees" },
  { value: "etsy_transaction_fees", label: "Transaction Fees", group: "fees" },
  { value: "etsy_processing_fees", label: "Processing Fees", group: "fees" },
  { value: "share_save_refunds_credits", label: "Share & Save Credits", group: "fees", isCredit: true },
  { value: "other_fees", label: "Other Fees", group: "fees" },
  { value: "etsy_ads", label: "Etsy Ads", group: "ads" },
  { value: "etsy_offsite_ads_fees", label: "Offsite Ads", group: "ads" },
  { value: "etsy_shipping", label: "Shipping Labels (Etsy)", group: "shipping" },
  { value: "other_postage_costs", label: "Other Postage", group: "shipping" },
];

export const ALL_EXPENSE_CATEGORIES = [
  ...BUSINESS_EXPENSE_CATEGORIES,
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
  tools_equipment: "bg-amber-100 text-amber-700",
  advertising_marketing: "bg-pink-100 text-pink-700",
  office_expenses: "bg-emerald-100 text-emerald-700",
  professional_services: "bg-violet-100 text-violet-700",
  other: "bg-stone-100 text-stone-600",
  miscellaneous_expenses: "bg-stone-200 text-stone-700",
  etsy_listing_fees: "bg-orange-100 text-orange-700",
  etsy_transaction_fees: "bg-orange-200 text-orange-800",
  etsy_processing_fees: "bg-orange-100 text-orange-700",
  share_save_refunds_credits: "bg-emerald-100 text-emerald-700",
  other_fees: "bg-orange-200 text-orange-800",
  etsy_ads: "bg-purple-100 text-purple-700",
  etsy_offsite_ads_fees: "bg-purple-200 text-purple-800",
  etsy_shipping: "bg-yellow-100 text-yellow-700",
  other_postage_costs: "bg-yellow-200 text-yellow-800",
};