import React from "react";
import CustomerCard from "./CustomerCard";
import { Users, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomerGridView({ customers, isLoading, onView, onEdit, onDelete, sortBy, sortDir, onSort }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-stone-100 rounded-xl h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 bg-stone-100 rounded-lg mb-4">
          <Users className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-lg font-semibold text-stone-900 mb-2">No customers yet</h3>
        <p className="text-stone-500">Start by adding your first customer.</p>
      </div>
    );
  }

  const SortHeader = ({ field, label }) => (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-stone-900 transition-colors"
    >
      {label}
      {sortBy === field && (
        sortDir === "asc" ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm font-semibold text-stone-600 px-2">
        <SortHeader field="name" label="Name" />
        <SortHeader field="email" label="Contact" />
        <SortHeader field="created_date" label="Added" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}