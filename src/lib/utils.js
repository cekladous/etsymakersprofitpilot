import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;


export const SUBSCRIPTION_TIER_LIMITS = { free: { quotesPerMonth: 5, reportMonths: 3, csvExport: false, aiEstimator: false }, maker_pro: { quotesPerMonth: Infinity, reportMonths: 12, csvExport: false, aiEstimator: false }, maker_plus: { quotesPerMonth: Infinity, reportMonths: Infinity, csvExport: true, aiEstimator: true } };
export function getActiveSubscription(subscriptions) { if (!Array.isArray(subscriptions) || subscriptions.length === 0) return null; return subscriptions.find(function(s) { return s.status === "active" || s.status === "trial"; }) || null; }
export function getSubscriptionTier(subscriptions) { const sub = getActiveSubscription(subscriptions); return (sub && SUBSCRIPTION_TIER_LIMITS[sub.plan_id]) ? sub.plan_id : "free"; }
export function getTierLimits(subscriptions) { return SUBSCRIPTION_TIER_LIMITS[getSubscriptionTier(subscriptions)] || SUBSCRIPTION_TIER_LIMITS.free; }
export function canCreateQuote(subscriptions, allQuotes) { const limits = getTierLimits(subscriptions); if (limits.quotesPerMonth === Infinity) return true; const now = new Date(); const currentMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0"); const thisMonthQuotes = (allQuotes || []).filter(function(q) { const raw = q.created_date || q.created_at || q.createdAt; if (!raw) return false; const d = new Date(raw); return (d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")) === currentMonth; }); return thisMonthQuotes.length < limits.quotesPerMonth; }
export function canExportCSV(subscriptions) { return !!getTierLimits(subscriptions).csvExport; }
export function canUseAI(subscriptions) { return !!getTierLimits(subscriptions).aiEstimator; }
export function getReportMonthLimit(subscriptions) { return getTierLimits(subscriptions).reportMonths; }