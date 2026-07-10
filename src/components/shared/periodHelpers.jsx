/**
 * Period bucketing helpers for Month/Quarter/Year views
 */

import { format, startOfMonth, startOfQuarter, startOfYear, getQuarter } from "date-fns";

/**
 * Parse a date string (yyyy-MM-dd) as a LOCAL calendar date at midnight,
 * avoiding the UTC timezone shift that causes month-boundary bucketing errors.
 * Falls back to native Date parsing for non-ISO formats.
 */
export function parseLocalDate(value) {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(str);
}

/**
 * Get period key from date
 * @param {string|Date} dateISO - Date string or Date object
 * @param {string} mode - "month" | "quarter" | "year"
 * @returns {string} Period key (e.g., "2024-01", "2024-Q1", "2024")
 */
export function getPeriodKey(dateISO, mode) {
  const date = parseLocalDate(dateISO);
  
  if (mode === "month") {
    return format(date, "yyyy-MM");
  } else if (mode === "quarter") {
    const quarter = getQuarter(date);
    return `${format(date, "yyyy")}-Q${quarter}`;
  } else if (mode === "year") {
    return format(date, "yyyy");
  }
  
  return format(date, "yyyy-MM");
}

/**
 * Get period start date (first day of period)
 * @param {string|Date} dateISO - Date string or Date object
 * @param {string} mode - "month" | "quarter" | "year"
 * @returns {Date} First day of period
 */
export function getPeriodStart(dateISO, mode) {
  const date = parseLocalDate(dateISO);
  
  if (mode === "month") {
    return startOfMonth(date);
  } else if (mode === "quarter") {
    return startOfQuarter(date);
  } else if (mode === "year") {
    return startOfYear(date);
  }
  
  return startOfMonth(date);
}

/**
 * Get period label for display
 * @param {string} periodKey - Period key (e.g., "2024-01", "2024-Q1", "2024")
 * @param {string} mode - "month" | "quarter" | "year"
 * @returns {string} Display label
 */
export function getPeriodLabel(periodKey, mode) {
  if (mode === "month") {
    const [year, month] = periodKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, "MMM yyyy");
  } else if (mode === "quarter") {
    return periodKey; // Already formatted as "2024-Q1"
  } else if (mode === "year") {
    return periodKey; // Just "2024"
  }
  
  return periodKey;
}

/**
 * Aggregate data by period
 * @param {Array} data - Array of objects with date field
 * @param {string} dateField - Name of the date field
 * @param {string} mode - "month" | "quarter" | "year"
 * @returns {Object} Map of periodKey -> array of items
 */
export function groupByPeriod(data, dateField, mode) {
  const grouped = {};
  
  data.forEach(item => {
    const periodKey = getPeriodKey(item[dateField], mode);
    if (!grouped[periodKey]) {
      grouped[periodKey] = [];
    }
    grouped[periodKey].push(item);
  });
  
  return grouped;
}