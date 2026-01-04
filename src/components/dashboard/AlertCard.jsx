import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

export default function AlertCard({ title, count, description, linkTo, type = "warning" }) {
  const typeClasses = {
    warning: {
      bg: "bg-amber-50 border-amber-200",
      icon: "text-amber-500",
      badge: "bg-amber-100 text-amber-700"
    },
    danger: {
      bg: "bg-rose-50 border-rose-200",
      icon: "text-rose-500",
      badge: "bg-rose-100 text-rose-700"
    },
    info: {
      bg: "bg-blue-50 border-blue-200",
      icon: "text-blue-500",
      badge: "bg-blue-100 text-blue-700"
    }
  };

  const classes = typeClasses[type] || typeClasses.warning;

  if (count === 0) return null;

  return (
    <Link
      to={linkTo}
      className={`flex items-center gap-4 p-4 rounded-xl border ${classes.bg} hover:shadow-md transition-all duration-200 group`}
    >
      <AlertTriangle className={`w-5 h-5 ${classes.icon} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-stone-800">{title}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${classes.badge}`}>
            {count}
          </span>
        </div>
        <p className="text-sm text-stone-500 truncate">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-stone-400 group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}