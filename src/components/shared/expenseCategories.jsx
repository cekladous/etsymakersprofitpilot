/**
 * Single source of truth for expense categories
 * Used across Monthly Summary, BusinessExpense, and all reports
 */

export const EXPENSE_CATEGORY_GROUPS = {
  selling_expenses: {
    label: "Selling Expenses",
    color: "bg-cyan-50",
    categories: [
      { name: "etsy_listing_fees", label: "Etsy Listing Fees" },
      { name: "etsy_transaction_fees", label: "Etsy Transaction Fees" },
      { name: "etsy_processing_fees", label: "Etsy Processing Fees" },
      { name: "share_save_refunds_credits", label: "Share & Save Fee Refunds & Misc. Credits" },
      { name: "other_fees", label: "Other Fees" },
      { name: "etsy_ads", label: "Etsy Ads" },
      { name: "etsy_offsite_ads_fees", label: "Etsy Offsite Ads Fees" },
      { name: "etsy_shipping", label: "Etsy Shipping" },
      { name: "other_postage_costs", label: "Other Postage Costs" },
    ],
  },
  product_expenses: {
    label: "Product Expenses",
    color: "bg-pink-100",
    categories: [
      { name: "materials_supplies", label: "Materials & Supplies" },
      { name: "tools_equipment", label: "Tools & Equipment" },
    ],
  },
  business_expenses: {
    label: "Business Expenses",
    color: "bg-purple-100",
    categories: [
      { name: "advertising_marketing", label: "Advertising & Marketing" },
      { name: "office_expenses", label: "Office Expenses" },
      { name: "professional_services", label: "Professional Services" },
      { name: "other", label: "Other" },
      { name: "miscellaneous_expenses", label: "Miscellaneous Expenses" },
    ],
  },
};

export const getAllCategories = () => {
  const all = [];
  Object.entries(EXPENSE_CATEGORY_GROUPS).forEach(([groupKey, group]) => {
    group.categories.forEach(cat => {
      all.push({
        ...cat,
        group: groupKey,
        groupLabel: group.label,
      });
    });
  });
  return all;
};

export const getCategoryLabel = (categoryName) => {
  const allCats = getAllCategories();
  return allCats.find(c => c.name === categoryName)?.label || categoryName;
};