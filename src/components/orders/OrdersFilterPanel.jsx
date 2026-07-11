import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export default function OrdersFilterPanel({ filters, onChange, onClear }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  const activeCount = Object.entries(filters).filter(
    ([, v]) => v !== "" && v !== null && v !== undefined
  ).length;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <Filter className="w-4 h-4 text-emerald-500" />
          Filter Orders
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-stone-400 hover:text-stone-600 h-7"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Order #</label>
          <Input
            placeholder="Search..."
            value={filters.orderNumber}
            onChange={(e) => update("orderNumber", e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Date From</label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Date To</label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Buyer</label>
          <Input
            placeholder="Search..."
            value={filters.buyer}
            onChange={(e) => update("buyer", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">
            Item Total (min–max)
          </label>
          <div className="flex gap-1">
            <Input
              type="number"
              placeholder="Min"
              value={filters.itemTotalMin}
              onChange={(e) => update("itemTotalMin", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.itemTotalMax}
              onChange={(e) => update("itemTotalMax", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">
            Fees (min–max)
          </label>
          <div className="flex gap-1">
            <Input
              type="number"
              placeholder="Min"
              value={filters.feesMin}
              onChange={(e) => update("feesMin", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.feesMax}
              onChange={(e) => update("feesMax", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">
            Order Profit (min–max)
          </label>
          <div className="flex gap-1">
            <Input
              type="number"
              placeholder="Min"
              value={filters.profitMin}
              onChange={(e) => update("profitMin", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.profitMax}
              onChange={(e) => update("profitMax", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Status</label>
          <Select
            value={filters.status || "all"}
            onValueChange={(v) => update("status", v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="in_production">In Production</SelectItem>
              <SelectItem value="Canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}