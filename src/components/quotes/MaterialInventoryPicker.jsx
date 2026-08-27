import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Search, Package, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n || 0);

export default function MaterialInventoryPicker({
  open,
  onOpenChange,
  onPick,
  onEnterManually,
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: materialTypes = [], isLoading } = useQuery({
    queryKey: ["materialTypes", user?.id],
    enabled: !!user && open,
    queryFn: () => base44.entities.MaterialType.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items", user?.id],
    enabled: !!user && open,
    queryFn: () => base44.entities.InventoryItem.filter({ owner_user_id: user.id }, "-last_updated", 500),
  });

  // Merge catalog (MaterialType) with stock (InventoryItem) — same model as the
  // Inventory page, so the picker reflects exactly what the seller maintains.
  const merged = materialTypes.map((mt) => {
    const inv = inventoryItems.find((i) => i.material_name === mt.name);
    return {
      id: mt.id,
      name: mt.name,
      category: mt.category,
      thickness: mt.thickness || "",
      supplier: mt.supplier || "",
      cost_per_sheet: mt.cost_per_sheet || 0,
      unit_of_measure: mt.unit_of_measure || "",
      average_cost: inv?.average_cost || mt.cost_per_sheet || 0,
      quantity_on_hand: inv?.quantity_on_hand || 0,
      inventoryItemId: inv?.id || null,
    };
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? merged.filter((m) =>
        [m.name, m.thickness, m.category, m.supplier, m.unit_of_measure]
          .filter(Boolean)
          .some((f) => f.toLowerCase().includes(q))
      )
    : merged;

  const handlePick = (item) => {
    onPick(item);
    onOpenChange(false);
    setSearch("");
  };

  const handleManual = () => {
    onEnterManually();
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose material from inventory</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, supplier, unit…"
            className="pl-9"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-1">
          {isLoading && (
            <p className="text-sm text-stone-500 text-center py-8">Loading inventory…</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-stone-500 text-center py-8">
              {search ? `No materials match "${search}"` : "No inventory items yet"}
            </p>
          )}
          {!isLoading &&
            filtered.map((item) => {
              const out = item.quantity_on_hand === 0;
              const low = !out && item.quantity_on_hand <= 5;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePick(item)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-stone-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {item.name}
                      {item.thickness && (
                        <span className="ml-2 text-xs font-normal text-stone-500">{item.thickness}</span>
                      )}
                    </p>
                    <p className="text-xs text-stone-500 truncate">
                      {item.supplier || "No supplier"}
                      {item.unit_of_measure ? ` · ${item.unit_of_measure}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-stone-900">{fmt(item.average_cost)}</p>
                    <p
                      className={`text-xs ${
                        out ? "text-rose-600" : low ? "text-amber-600" : "text-stone-400"
                      }`}
                    >
                      {item.quantity_on_hand} on hand
                    </p>
                  </div>
                </button>
              );
            })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleManual} className="w-full">
            Not in inventory? Enter manually
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}