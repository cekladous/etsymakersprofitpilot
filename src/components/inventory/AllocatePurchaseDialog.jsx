import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package } from "lucide-react";

export default function AllocatePurchaseDialog({ open, onOpenChange, purchase }) {
  const { user } = useAuth();
  const [materialTypeId, setMaterialTypeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialType.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.InventoryItem.filter({ owner_user_id: user.id }, "-last_updated", 500),
  });

  useEffect(() => {
    if (open && purchase) {
      // Default: match a material type by name
      const match = materialTypes.find(
        (t) => t.name?.toLowerCase() === (purchase.material_name || "").toLowerCase()
      );
      setMaterialTypeId(match?.id || "");
      setQuantity(purchase.quantity != null ? String(purchase.quantity) : "1");
      const total = purchase.amount || 0;
      const qty = purchase.quantity || 1;
      setUnitCost(qty ? (total / qty).toFixed(2) : String(total));
      setNotes("");
    }
  }, [open, purchase]); // eslint-disable-line react-hooks/exhaustive-deps

  const allocateMutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(quantity);
      const cost = parseFloat(unitCost) || 0;
      if (!materialTypeId || !qty || qty <= 0) {
        throw new Error("Select a material and enter a valid quantity.");
      }
      const materialType = materialTypes.find((t) => t.id === materialTypeId);
      const materialName = materialType.name;
      const existing = inventoryItems.find(
        (i) => i.material_name?.toLowerCase() === materialName.toLowerCase()
      );

      let inventoryItemId;
      if (existing) {
        const existingQty = existing.quantity_on_hand || 0;
        const existingAvg = existing.average_cost || 0;
        const newQty = existingQty + qty;
        const newAvg = newQty > 0 ? (existingQty * existingAvg + qty * cost) / newQty : cost;
        await base44.entities.InventoryItem.update(existing.id, {
          quantity_on_hand: newQty,
          average_cost: newAvg,
          total_value: newQty * newAvg,
          last_updated: new Date().toISOString(),
        });
        inventoryItemId = existing.id;
      } else {
        const created = await base44.entities.InventoryItem.create({
          owner_user_id: user.id,
          material_name: materialName,
          quantity_on_hand: qty,
          average_cost: cost,
          total_value: qty * cost,
          last_updated: new Date().toISOString(),
        });
        inventoryItemId = created.id;
      }

      await base44.entities.InventoryTransaction.create({
        owner_user_id: user.id,
        inventory_item_id: inventoryItemId,
        transaction_date: purchase.date || new Date().toISOString().split("T")[0],
        transaction_type: "purchase",
        quantity_change: qty,
        unit_cost: cost,
        reference_id: purchase.id,
        notes: notes || `Allocated from ${purchase.source}: ${purchase.material_name}`,
      });

      // If this came from a BusinessExpense, mark it as inventory
      if (purchase.source === "expense") {
        await base44.entities.BusinessExpense.update(purchase.id, { inventory_flag: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
      queryClient.invalidateQueries({ queryKey: ["material-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["material-purchases"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Allocation failed:", error);
      alert(error.message || "Failed to allocate purchase to inventory.");
    },
  });

  if (!purchase) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    allocateMutation.mutate();
  };

  const qtyNum = parseFloat(quantity) || 0;
  const costNum = parseFloat(unitCost) || 0;
  const lineTotal = qtyNum * costNum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Allocate Purchase to Inventory
          </DialogTitle>
          <DialogDescription>
            Link this purchase to a material type and add it to your stock on hand.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Purchase summary */}
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Purchase:</span>
              <span className="font-medium text-stone-800 truncate ml-2">{purchase.material_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Vendor / Date:</span>
              <span className="text-stone-700">{purchase.vendor} • {purchase.date}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Purchase Total:</span>
              <span className="font-semibold text-stone-900">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(purchase.amount)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Allocate to Material Type *</Label>
            <Select value={materialTypeId} onValueChange={setMaterialTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a material type..." />
              </SelectTrigger>
              <SelectContent>
                {materialTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.thickness ? ` (${t.thickness})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {materialTypes.length === 0 && (
              <p className="text-xs text-amber-600">
                No material types yet — add one in the Material Types tab first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantity Received *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
          </div>

          {qtyNum > 0 && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-emerald-900">
                Adding <strong>{qtyNum}</strong> units at{" "}
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(costNum)}/unit
                {" "}— line total{" "}
                <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(lineTotal)}</strong>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this allocation"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={allocateMutation.isPending || !materialTypeId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {allocateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Allocate to Inventory
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}