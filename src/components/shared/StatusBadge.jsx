import React from "react";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  // Order statuses
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
  in_production: { label: "In Production", className: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  shipped: { label: "Shipped", className: "bg-violet-100 text-violet-700 border-violet-200" },
  
  // Job statuses
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
  
  // Material statuses
  available: { label: "Available", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  in_use: { label: "In Use", className: "bg-blue-100 text-blue-700 border-blue-200" },
  depleted: { label: "Depleted", className: "bg-stone-100 text-stone-600 border-stone-200" },
  low_stock: { label: "Low Stock", className: "bg-amber-100 text-amber-700 border-amber-200" },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || {
    label: status?.replace(/_/g, " ") || "Unknown",
    className: "bg-stone-100 text-stone-600"
  };

  return (
    <Badge variant="outline" className={`font-medium capitalize ${config.className}`}>
      {config.label}
    </Badge>
  );
}