import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  linkTo,
  accentColor = "emerald"
}) {
  const colorClasses = {
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", trend: "text-emerald-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600", trend: "text-amber-600" },
    rose: { bg: "bg-rose-50", icon: "text-rose-600", trend: "text-rose-600" },
    blue: { bg: "bg-blue-50", icon: "text-blue-600", trend: "text-blue-600" },
    violet: { bg: "bg-violet-50", icon: "text-violet-600", trend: "text-violet-600" },
  };

  const colors = colorClasses[accentColor] || colorClasses.emerald;

  const content = (
    <div className="bg-white rounded-2xl p-6 border border-stone-100 hover:border-stone-200 hover:shadow-lg transition-all duration-300 h-full">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors.bg}`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            trend === "up" ? "text-emerald-600" : "text-rose-600"
          }`}>
            {trend === "up" ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {trendValue}
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <p className="text-sm font-medium text-stone-500">{title}</p>
        <p className="text-3xl font-bold text-stone-900 tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-sm text-stone-400">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="block">
        {content}
      </Link>
    );
  }

  return content;
}