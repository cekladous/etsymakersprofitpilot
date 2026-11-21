import { base44 } from "@/api/base44Client";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
} from "date-fns";

export const EXPORT_PRESETS = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter" },
  { id: "ytd", label: "Year to date" },
  { id: "last_year", label: "Last year" },
  { id: "custom", label: "Custom dates" },
];

const parseDay = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
};

export function resolveRange(preset, customStart, customEnd) {
  const now = new Date();
  switch (preset) {
    case "last_month": {
      const month = subMonths(now, 1);
      return {
        start: startOfMonth(month),
        end: endOfMonth(month),
        label: format(month, "MMMM yyyy"),
      };
    }
    case "this_quarter":
      return {
        start: startOfQuarter(now),
        end: endOfQuarter(now),
        label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
      };
    case "ytd":
      return {
        start: startOfYear(now),
        end: now,
        label: `${now.getFullYear()} Year to Date`,
      };
    case "last_year": {
      const year = subYears(now, 1);
      return {
        start: startOfYear(year),
        end: endOfYear(year),
        label: `${year.getFullYear()}`,
      };
    }
    case "custom": {
      const start = parseDay(customStart);
      const end = parseDay(customEnd);
      if (!start || !end) return { error: "Choose a start and end date." };
      if (start > end) return { error: "The start date must be before the end date." };
      return {
        start,
        end,
        label: `${format(start, "MMM d, yyyy")} to ${format(end, "MMM d, yyyy")}`,
      };
    }
    default:
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        label: format(now, "MMMM yyyy"),
      };
  }
}

export async function downloadAccountantReport({ start, end, label, fileFormat }) {
  const response = await base44.functions.invoke("exportDashboardReport", {
    format: fileFormat,
    periodStart: format(start, "yyyy-MM-dd"),
    periodEnd: format(end, "yyyy-MM-dd"),
    periodLabel: label,
    encoding: "base64",
  });

  const data = response?.data;
  if (!data?.base64) {
    throw new Error(data?.error || "Could not generate the report.");
  }

  const bytes = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: data.mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    data.filename ||
    `accountant-report-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.${fileFormat === "pdf" ? "pdf" : "xlsx"}`;
  link.click();
  URL.revokeObjectURL(url);
}