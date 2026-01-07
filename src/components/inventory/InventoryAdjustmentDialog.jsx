import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export default function InventoryAdjustmentDialog({ open, onOpenChange, item }) {
  const [quantityChange, setQuantityChange] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setQuantityChange("");
      setNotes("");
    }
  }, [open]);

  const adjustMutation = useMutation({
    mutationFn: async (data) => {
      const change = parseFloat(data.quantityChange);
      const newQuantity = (item.quantity_on_hand || 0) + change;
      const newTotalValue = newQuantity * item.average_cost;

      // Create transaction record
      await base44.entities.InventoryTransaction.create({
        inventory_item_id: item.id,
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_type: "adjustment",
        quantity_change: change,
        unit_cost: item.average_cost,
        notes: data.notes,
      });

      // Update inventory item
      await base44.entities.InventoryItem.update(item.id, {
        quantity_on_hand: newQuantity,
        total_value: newTotalValue,
        last_updated: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!quantityChange || parseFloat(quantityChange) === 0) return;
    adjustMutation.mutate({ quantityChange, notes });
  };

  if (!item) return null;

  const change = parseFloat(quantityChange) || 0;
  const newQuantity = (item.quantity_on_hand || 0) + change;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Inventory: {item.material_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 bg-stone-50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Current Quantity:</span>
              <span className="font-semibold">{item.quantity_on_hand}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Average Cost:</span>
              <span className="font-semibold">
                ${item.average_cost?.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quantity Change *</Label>
            <Input
              type="number"
              step="0.01"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              placeholder="Enter + or - amount (e.g., -5 or +10)"
              required
            />
            <p className="text-xs text-stone-500">
              Use negative numbers to reduce quantity, positive to add
            </p>
          </div>

          {quantityChange && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                New Quantity: <strong>{newQuantity.toFixed(2)}</strong>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {adjustMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Adjust Inventory
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}