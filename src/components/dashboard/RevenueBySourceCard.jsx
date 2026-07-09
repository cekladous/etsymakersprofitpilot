import React from "react";
import { ShoppingBag, Store, CreditCard, Wallet, Globe, Instagram, MoreHorizontal, Smartphone } from "lucide-react";

const SOURCE_CONFIG = [
  { key: "Etsy", icon: ShoppingBag, color: "text-orange-600", bg: "bg-orange-50", bar: "bg-orange-500" },
  { key: "In-Person (Square)", icon: Smartphone, color: "text-slate-700", bg: "bg-slate-50", bar: "bg-slate-600" },
  { key: "Squarespace", icon: Store, color: "text-stone-700", bg: "bg-stone-50", bar: "bg-stone-600" },
  { key: "Square", icon: CreditCard, color: "text-slate-700", bg: "bg-slate-50", bar: "bg-slate-500" },
  { key: "In-Person/Cash", icon: Wallet, color: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-500" },
  { key: "Website", icon: Globe, color: "text-blue-700", bg: "bg-blue-50", bar: "bg-blue-500" },
  { key: "Instagram", icon: Instagram, color: "text-pink-700", bg: "bg-pink-50", bar: "bg-pink-500" },
  { key: "Other", icon: MoreHorizontal, color: "text-violet-700", bg: "bg-violet-50", bar: "bg-violet-500" },
];

export default function RevenueBySourceCard({ financialData }) {
  const bySource = financialData?.revenue?.bySource || {};
  const total = Object.values(bySource).reduce((sum, v) => sum + (Number(v) || 0), 0);

  const sources = SOURCE_CONFIG.map(cfg => ({
    ...cfg,
    amount: Number(bySource[cfg.key]) || 0,
  })).filter(s => s.amount > 0);

  if (sources.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-sm font-semibold text-stone-900 mb-1">Revenue by Source</h3>
        <p className="text-sm text-stone-500">No sales recorded for this period.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Revenue by Source</h3>
          <p className="text-xs text-stone-500 mt-0.5">Where your money is coming from</p>
        </div>
        <p className="text-lg font-bold text-stone-900">
          ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="space-y-3">
        {sources.map(({ key, icon: Icon, color, bg, bar, amount }) => {
          const pct = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-md ${bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </span>
                  <span className="text-sm font-medium text-stone-700">{key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900">
                    ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-stone-400 w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${bar} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}