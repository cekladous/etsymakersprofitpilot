// Approximate average retail electricity rates (local currency per kWh)
// US rates from EIA data; Canadian rates from CER/ provincial utilities; international rates from national energy agencies.

export const STATE_ELECTRICITY_RATES = {
  AL: 0.1433, AK: 0.2368, AZ: 0.1389, AR: 0.1186, CA: 0.2415,
  CO: 0.1372, CT: 0.3075, DE: 0.1468, FL: 0.1388, GA: 0.1370,
  HI: 0.3882, ID: 0.1039, IL: 0.1490, IN: 0.1406, IA: 0.1304,
  KS: 0.1357, KY: 0.1295, LA: 0.1185, ME: 0.2195, MD: 0.1580,
  MA: 0.2845, MI: 0.1776, MN: 0.1413, MS: 0.1235, MO: 0.1223,
  MT: 0.1213, NE: 0.1135, NV: 0.1379, NH: 0.2556, NJ: 0.1601,
  NM: 0.1339, NY: 0.2079, NC: 0.1173, ND: 0.1031, OH: 0.1434,
  OK: 0.1130, OR: 0.1191, PA: 0.1552, RI: 0.2607, SC: 0.1346,
  SD: 0.1237, TN: 0.1244, TX: 0.1306, UT: 0.1097, VT: 0.1938,
  VA: 0.1404, WA: 0.0983, WV: 0.1424, WI: 0.1584, WY: 0.1075,
  DC: 0.1485,
};

export const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" }, { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" }, { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" }, { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" }, { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" }, { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" }, { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" }, { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export const NATIONAL_AVG_RATE = 0.1606;

// Canadian provincial electricity rates (CAD per kWh, approximate 2025-2026)
export const CANADA_PROVINCE_RATES = {
  AB: 0.182, BC: 0.128, MB: 0.099, NB: 0.139, NL: 0.144,
  NS: 0.172, NT: 0.292, NU: 0.375, ON: 0.124, PE: 0.172,
  QC: 0.079, SK: 0.184, YT: 0.162,
};

export const CANADIAN_PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

export const CANADA_AVG_RATE = 0.155;

// International electricity rates (approximate, in local currency per kWh)
export const INTERNATIONAL_RATES = [
  { value: "AU", label: "Australia", rate: 0.25, currency: "AUD" },
  { value: "AT", label: "Austria", rate: 0.29, currency: "EUR" },
  { value: "BE", label: "Belgium", rate: 0.31, currency: "EUR" },
  { value: "BR", label: "Brazil", rate: 0.15, currency: "BRL" },
  { value: "CN", label: "China", rate: 0.08, currency: "CNY" },
  { value: "DK", label: "Denmark", rate: 0.40, currency: "DKK" },
  { value: "FI", label: "Finland", rate: 0.20, currency: "EUR" },
  { value: "FR", label: "France", rate: 0.21, currency: "EUR" },
  { value: "DE", label: "Germany", rate: 0.38, currency: "EUR" },
  { value: "IN", label: "India", rate: 0.08, currency: "INR" },
  { value: "IE", label: "Ireland", rate: 0.30, currency: "EUR" },
  { value: "IT", label: "Italy", rate: 0.28, currency: "EUR" },
  { value: "JP", label: "Japan", rate: 0.26, currency: "JPY" },
  { value: "MX", label: "Mexico", rate: 0.11, currency: "MXN" },
  { value: "NL", label: "Netherlands", rate: 0.31, currency: "EUR" },
  { value: "NZ", label: "New Zealand", rate: 0.22, currency: "NZD" },
  { value: "NO", label: "Norway", rate: 0.17, currency: "NOK" },
  { value: "PL", label: "Poland", rate: 0.23, currency: "PLN" },
  { value: "PT", label: "Portugal", rate: 0.24, currency: "EUR" },
  { value: "SG", label: "Singapore", rate: 0.27, currency: "SGD" },
  { value: "ZA", label: "South Africa", rate: 0.07, currency: "ZAR" },
  { value: "ES", label: "Spain", rate: 0.25, currency: "EUR" },
  { value: "SE", label: "Sweden", rate: 0.21, currency: "SEK" },
  { value: "CH", label: "Switzerland", rate: 0.28, currency: "CHF" },
  { value: "GB", label: "United Kingdom", rate: 0.27, currency: "GBP" },
];

export const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  ...INTERNATIONAL_RATES.map(r => ({ value: r.value, label: r.label })),
  { value: "OTHER", label: "Other / Enter Manually" },
];

export function getRateForLocation(country, region) {
  if (country === "US") {
    return STATE_ELECTRICITY_RATES[region] ?? NATIONAL_AVG_RATE;
  }
  if (country === "CA") {
    return CANADA_PROVINCE_RATES[region] ?? CANADA_AVG_RATE;
  }
  const intl = INTERNATIONAL_RATES.find(r => r.value === country);
  if (intl) return intl.rate;
  return null; // null = use manual entry
}

export function getCurrencyForCountry(country) {
  if (country === "US") return "USD";
  if (country === "CA") return "CAD";
  const intl = INTERNATIONAL_RATES.find(r => r.value === country);
  if (intl) return intl.currency;
  return "";
}