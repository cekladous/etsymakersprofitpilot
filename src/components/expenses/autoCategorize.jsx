/**
 * Auto-categorize a transaction based on merchant keywords in the description.
 * User-defined rules (from Settings.auto_categorization_rules) take precedence
 * over the built-in defaults.
 *
 * Rules are checked in order — first match wins — so more specific keywords
 * (e.g. gas-station brand names) must appear before broader ones (e.g. "gas").
 */

// Built-in keyword → category mappings (checked in order, first match wins)
const DEFAULT_KEYWORD_RULES = [
  // Shipping & Postage
  { keyword: "usps", category: "shipping_postage" },
  { keyword: "united states postal", category: "shipping_postage" },
  { keyword: "ups", category: "shipping_postage" },
  { keyword: "fedex", category: "shipping_postage" },
  { keyword: "dhl", category: "shipping_postage" },
  { keyword: "pirateship", category: "shipping_postage" },
  { keyword: "shippo", category: "shipping_postage" },
  { keyword: "goshippo", category: "shipping_postage" },
  { keyword: "stamps.com", category: "shipping_postage" },

  // Gas / Mileage — BEFORE the "gas" utility keyword so brand names match first
  { keyword: "shell", category: "gas_mileage" },
  { keyword: "exxon", category: "gas_mileage" },
  { keyword: "chevron", category: "gas_mileage" },
  { keyword: "bp", category: "gas_mileage" },
  { keyword: "mobil", category: "gas_mileage" },
  { keyword: "speedway", category: "gas_mileage" },
  { keyword: "circle k", category: "gas_mileage" },
  { keyword: "sunoco", category: "gas_mileage" },
  { keyword: "racetrac", category: "gas_mileage" },
  { keyword: "quiktrip", category: "gas_mileage" },

  // Advertising & Marketing
  { keyword: "google ads", category: "advertising_marketing" },
  { keyword: "google adwords", category: "advertising_marketing" },
  { keyword: "facebook", category: "advertising_marketing" },
  { keyword: "facebk", category: "advertising_marketing" },
  { keyword: "meta platforms", category: "advertising_marketing" },
  { keyword: "meta", category: "advertising_marketing" },
  { keyword: "instagram", category: "advertising_marketing" },
  { keyword: "pinterest", category: "advertising_marketing" },
  { keyword: "pinterest ads", category: "advertising_marketing" },
  { keyword: "tiktok", category: "advertising_marketing" },
  { keyword: "tiktok ads", category: "advertising_marketing" },

  // Software & Subscriptions
  { keyword: "adobe", category: "software_subscriptions" },
  { keyword: "microsoft", category: "software_subscriptions" },
  { keyword: "canva", category: "software_subscriptions" },
  { keyword: "github", category: "software_subscriptions" },
  { keyword: "notion", category: "software_subscriptions" },
  { keyword: "shopify", category: "software_subscriptions" },
  { keyword: "squarespace", category: "software_subscriptions" },
  { keyword: "google storage", category: "software_subscriptions" },
  { keyword: "google workspace", category: "software_subscriptions" },
  { keyword: "google gsuite", category: "software_subscriptions" },
  { keyword: "gsuite", category: "software_subscriptions" },
  { keyword: "dropbox", category: "software_subscriptions" },
  { keyword: "netflix", category: "software_subscriptions" },
  { keyword: "spotify", category: "software_subscriptions" },
  { keyword: "base44", category: "software_subscriptions" },
  { keyword: "quickbooks", category: "software_subscriptions" },
  { keyword: "zapier", category: "software_subscriptions" },
  { keyword: "slack", category: "software_subscriptions" },
  { keyword: "ionos", category: "software_subscriptions" },
  { keyword: "godaddy", category: "software_subscriptions" },
  { keyword: "wixcom", category: "software_subscriptions" },
  { keyword: "wix", category: "software_subscriptions" },
  { keyword: "namecheap", category: "software_subscriptions" },
  { keyword: "bluehost", category: "software_subscriptions" },

  // Utilities / Cell Phone
  { keyword: "at&t", category: "utilities_cell_phone" },
  { keyword: "verizon", category: "utilities_cell_phone" },
  { keyword: "t-mobile", category: "utilities_cell_phone" },
  { keyword: "tmobile", category: "utilities_cell_phone" },
  { keyword: "comcast", category: "utilities_cell_phone" },
  { keyword: "xfinity", category: "utilities_cell_phone" },
  { keyword: "duke energy", category: "utilities_cell_phone" },
  { keyword: "electric", category: "utilities_cell_phone" },
  { keyword: "electricity", category: "utilities_cell_phone" },
  { keyword: "water dept", category: "utilities_cell_phone" },
  { keyword: "water", category: "utilities_cell_phone" },
  { keyword: "gas company", category: "utilities_cell_phone" },
  { keyword: "gas", category: "utilities_cell_phone" },
  { keyword: "utility", category: "utilities_cell_phone" },
  { keyword: "utilities", category: "utilities_cell_phone" },

  // Tools & Equipment
  { keyword: "home depot", category: "tools_equipment" },
  { keyword: "lowes", category: "tools_equipment" },
  { keyword: "harbor freight", category: "tools_equipment" },
  { keyword: "northern tool", category: "tools_equipment" },
  { keyword: "mcmaster", category: "tools_equipment" },
  { keyword: "grainger", category: "tools_equipment" },
  { keyword: "cricut", category: "tools_equipment" },
  { keyword: "xtool", category: "tools_equipment" },
  { keyword: "glowforge", category: "tools_equipment" },
  { keyword: "laser", category: "tools_equipment" },
  { keyword: "silhouette", category: "tools_equipment" },

  // Materials & Supplies (Craft Supplies)
  { keyword: "amazon", category: "materials_supplies" },
  { keyword: "amzn", category: "materials_supplies" },
  { keyword: "michaels", category: "materials_supplies" },
  { keyword: "joann", category: "materials_supplies" },
  { keyword: "hobby lobby", category: "materials_supplies" },
  { keyword: "ac moore", category: "materials_supplies" },
  { keyword: "craft", category: "materials_supplies" },
  { keyword: "woodcraft", category: "materials_supplies" },
  { keyword: "rockler", category: "materials_supplies" },
  { keyword: "acme plastics", category: "materials_supplies" },
  { keyword: "tap plastics", category: "materials_supplies" },
  { keyword: "uline", category: "materials_supplies" },

  // Packaging Materials
  { keyword: "uline packaging", category: "packaging_materials" },
  { keyword: "packaging", category: "packaging_materials" },
  { keyword: "boxes", category: "packaging_materials" },
  { keyword: "bubble mailers", category: "packaging_materials" },

  // Office Supplies
  { keyword: "office depot", category: "office_general_expenses" },
  { keyword: "staples", category: "office_general_expenses" },
  { keyword: "office max", category: "office_general_expenses" },
  { keyword: "officemax", category: "office_general_expenses" },
  { keyword: "hp", category: "office_general_expenses" },
  { keyword: "instant ink", category: "office_general_expenses" },

  // Professional Services
  { keyword: "legal", category: "professional_services" },
  { keyword: "attorney", category: "professional_services" },
  { keyword: "cpa", category: "professional_services" },
  { keyword: "accountant", category: "professional_services" },
  { keyword: "bookkeeper", category: "professional_services" },

  // Payment Processing Fees
  { keyword: "venmo", category: "payment_processing_fees" },
  { keyword: "paypal", category: "payment_processing_fees" },
  { keyword: "stripe", category: "payment_processing_fees" },
  { keyword: "square", category: "payment_processing_fees" },

  // Insurance
  { keyword: "insurance", category: "insurance" },

  // Rent / Lease
  { keyword: "rent", category: "rent" },
  { keyword: "lease", category: "rent" },

  // Platform Fees (Etsy)
  { keyword: "etsy.com", category: "other_fees" },
  { keyword: "etsy", category: "other_fees" },
];

/**
 * Categorize a transaction description using user rules first, then defaults.
 * @param {string} description - The transaction description
 * @param {Array<{keyword: string, category: string}>} userRules - Optional user-defined rules
 * @returns {string} The category_name value, or "other" if no match
 */
export function autoCategorize(description, userRules = []) {
  if (!description) return "other";
  const desc = description.toLowerCase();

  // User rules take precedence
  for (const rule of userRules) {
    if (rule.keyword && desc.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }

  // Built-in defaults
  for (const rule of DEFAULT_KEYWORD_RULES) {
    if (desc.includes(rule.keyword)) {
      return rule.category;
    }
  }

  return "other";
}