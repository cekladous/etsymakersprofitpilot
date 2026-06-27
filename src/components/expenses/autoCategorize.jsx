/**
 * Auto-categorize a transaction based on merchant keywords in the description.
 * User-defined rules (from Settings.auto_categorization_rules) take precedence
 * over the built-in defaults.
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
  { keyword: "dropbox", category: "software_subscriptions" },
  { keyword: "netflix", category: "software_subscriptions" },
  { keyword: "spotify", category: "software_subscriptions" },

  // Utilities / Cell Phone
  { keyword: "at&t", category: "utilities_cell_phone" },
  { keyword: "verizon", category: "utilities_cell_phone" },
  { keyword: "t-mobile", category: "utilities_cell_phone" },
  { keyword: "tmobile", category: "utilities_cell_phone" },
  { keyword: "comcast", category: "utilities_cell_phone" },
  { keyword: "xfinity", category: "utilities_cell_phone" },
  { keyword: "duke energy", category: "utilities_cell_phone" },
  { keyword: "electric", category: "utilities_cell_phone" },
  { keyword: "gas company", category: "utilities_cell_phone" },
  { keyword: "water dept", category: "utilities_cell_phone" },

  // Gas / Mileage
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

  // Materials & Supplies
  { keyword: "amazon", category: "materials_supplies" },
  { keyword: "amzn", category: "materials_supplies" },
  { keyword: "michaels", category: "materials_supplies" },
  { keyword: "joann", category: "materials_supplies" },
  { keyword: "hobby lobby", category: "materials_supplies" },
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

  // Office / General
  { keyword: "office depot", category: "office_general_expenses" },
  { keyword: "staples", category: "office_general_expenses" },
  { keyword: "office max", category: "office_general_expenses" },

  // Professional Services
  { keyword: "legal", category: "professional_services" },
  { keyword: "attorney", category: "professional_services" },
  { keyword: "cpa", category: "professional_services" },
  { keyword: "accountant", category: "professional_services" },
  { keyword: "bookkeeper", category: "professional_services" },
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