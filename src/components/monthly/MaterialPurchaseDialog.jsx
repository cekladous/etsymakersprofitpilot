import React, { useState } from "react";
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

export default function MaterialPurchaseDialog({ open, onOpenChange }) {
  const [formData, setFormData] = useState({
    purchase_date: new Date().toISOString().split("T")[0],
    material_name: "",
    vendor: "",
    quantity: "",
    unit_cost: "",
    total_cost: "",
    payment_method: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const purchase = await base44.entities.MaterialPurchase.create({
        ...data,
        quantity: parseFloat(data.quantity || 0),
        unit_cost: parseFloat(data.unit_cost || 0),
        total_cost: parseFloat(data.total_cost || 0),
      });
      
      // Auto-update inventory
      try {
        const { processInventoryPurchase } = await import("../inventory/inventoryHelpers");
        await processInventoryPurchase(purchase);
        queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      } catch (error) {
        console.error("Failed to update inventory:", error);
      }
      
      return purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-purchases"] });
      onOpenChange(false);
      setFormData({
        purchase_date: new Date().toISOString().split("T")[0],
        material_name: "",
        vendor: "",
        quantity: "",
        unit_cost: "",
        total_cost: "",
        payment_method: "",
        notes: "",
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  // Auto-calculate total_cost when quantity or unit_cost changes
  const handleQuantityOrUnitChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    if (updated.quantity && updated.unit_cost) {
      updated.total_cost = (parseFloat(updated.quantity) * parseFloat(updated.unit_cost)).toFixed(2);
    }
    setFormData(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Material Purchase</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Date *</Label>
              <Input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="Amazon, Woodcraft, etc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Material Name *</Label>
            <Input
              value={formData.material_name}
              onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
              placeholder="Baltic Birch Plywood 1/8 inch"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => handleQuantityOrUnitChange("quantity", e.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_cost}
                onChange={(e) => handleQuantityOrUnitChange("unit_cost", e.target.value)}
                placeholder="12.50"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Cost *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Input
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              placeholder="Credit Card, PayPal, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Log Purchase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}