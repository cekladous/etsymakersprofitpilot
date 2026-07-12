import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function DonutChart({ data, totalLabel = "Total" }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

  const renderTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
    return (
      <div className="bg-white border border-stone-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-stone-900">{item.name}</p>
        <p className="text-stone-600">{formatCurrency(item.value)}</p>
        <p className="text-stone-400 text-xs">{pct}% of total</p>
      </div>
    );
  };

  if (!data || data.length === 0) {
    return <p className="text-sm text-stone-500 text-center py-8">No data available</p>;
  }

  return (
    <div>
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={1}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-stone-400">{totalLabel}</span>
          <span className="text-xl font-bold text-stone-900">{formatCurrency(total)}</span>
        </div>
      </div>
      <div className="mt-4 space-y-0.5 max-h-64 overflow-y-auto">
        {data.map((item, idx) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
          return (
            <div key={idx} className="flex items-center justify-between text-sm py-1.5 hover:bg-stone-50 -mx-2 px-2 rounded">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-stone-600 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-stone-400 tabular-nums">{pct}%</span>
                <span className="font-medium text-stone-900 tabular-nums">{formatCurrency(item.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}