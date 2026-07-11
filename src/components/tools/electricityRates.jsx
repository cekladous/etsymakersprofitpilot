// Approximate average retail electricity rates by state (EIA data, $/kWh)
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

export function getRateForState(stateCode) {
  return STATE_ELECTRICITY_RATES[stateCode] ?? NATIONAL_AVG_RATE;
}