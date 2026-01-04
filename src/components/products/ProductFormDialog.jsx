import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function ProductFormDialog({ open, onOpenChange, product, materialTypes, onClose }) {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    default_material_id: "",
    area_per_unit: "",
    laser_minutes_per_unit: "",
    packaging_cost: "",
    active: true,
    notes: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku || "",
        name: product.name || "",
        default_material_id: product.default_material_id || "",
        area_per_unit: product.area_per_unit?.toString() || "",
        laser_minutes_per_unit: product.laser_minutes_per_unit?.toString() || "",
        packaging_cost: product.packaging_cost?.toString() || "",
        active: product.active !== false,
        notes: product.notes || "",
      });
    } else {
      setFormData({
        sku: "",
        name: "",
        default_material_id: "",
        area_per_unit: "",
        laser_minutes_per_unit: "",
        packaging_cost: "",
        active: true,
        notes: "",
      });
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        area_per_unit: data.area_per_unit ? parseFloat(data.area_per_unit) : null,
        laser_minutes_per_unit: data.laser_minutes_per_unit ? parseFloat(data.laser_minutes_per_unit) : null,
        packaging_cost: data.packaging_cost ? parseFloat(data.packaging_cost) : null,
      };
      
      if (product) {
        return base44.entities.Product.update(product.id, payload);
      }
      return base44.entities.Product.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU *</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="PROD-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Laser Cut Coaster"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default Material</Label>
            <Select
              value={formData.default_material_id}
              onValueChange={(v) => setFormData({ ...formData, default_material_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {materialTypes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Area (sq in)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.area_per_unit}
                onChange={(e) => setFormData({ ...formData, area_per_unit: e.target.value })}
                placeholder="12"
              />
            </div>
            <div className="space-y-2">
              <Label>Laser Time (min)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.laser_minutes_per_unit}
                onChange={(e) => setFormData({ ...formData, laser_minutes_per_unit: e.target.value })}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label>Packaging ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.packaging_cost}
                onChange={(e) => setFormData({ ...formData, packaging_cost: e.target.value })}
                placeholder="0.50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Active Product</Label>
            <Switch
              checked={formData.active}
              onCheckedChange={(v) => setFormData({ ...formData, active: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {product ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}