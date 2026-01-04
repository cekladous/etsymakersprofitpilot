import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function MaterialTypeDialog({ open, onOpenChange, materialType, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "wood",
    thickness: "",
    default_width: "",
    default_height: "",
    cost_per_sheet: "",
    supplier: "",
    low_stock_threshold: 5,
    notes: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (materialType) {
      setFormData({
        name: materialType.name || "",
        category: materialType.category || "wood",
        thickness: materialType.thickness || "",
        default_width: materialType.default_width?.toString() || "",
        default_height: materialType.default_height?.toString() || "",
        cost_per_sheet: materialType.cost_per_sheet?.toString() || "",
        supplier: materialType.supplier || "",
        low_stock_threshold: materialType.low_stock_threshold || 5,
        notes: materialType.notes || "",
      });
    } else {
      setFormData({
        name: "",
        category: "wood",
        thickness: "",
        default_width: "",
        default_height: "",
        cost_per_sheet: "",
        supplier: "",
        low_stock_threshold: 5,
        notes: "",
      });
    }
  }, [materialType]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        default_width: data.default_width ? parseFloat(data.default_width) : null,
        default_height: data.default_height ? parseFloat(data.default_height) : null,
        cost_per_sheet: data.cost_per_sheet ? parseFloat(data.cost_per_sheet) : null,
      };
      
      if (materialType) {
        return base44.entities.MaterialType.update(materialType.id, payload);
      }
      return base44.entities.MaterialType.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
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
          <DialogTitle>{materialType ? "Edit Material" : "Add Material"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Material Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Baltic Birch Plywood"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wood">Wood</SelectItem>
                  <SelectItem value="acrylic">Acrylic</SelectItem>
                  <SelectItem value="leather">Leather</SelectItem>
                  <SelectItem value="paper">Paper</SelectItem>
                  <SelectItem value="fabric">Fabric</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Thickness</Label>
              <Input
                value={formData.thickness}
                onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
                placeholder='1/8"'
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Width (in)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.default_width}
                onChange={(e) => setFormData({ ...formData, default_width: e.target.value })}
                placeholder="12"
              />
            </div>
            <div className="space-y-2">
              <Label>Height (in)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.default_height}
                onChange={(e) => setFormData({ ...formData, default_height: e.target.value })}
                placeholder="24"
              />
            </div>
            <div className="space-y-2">
              <Label>Cost/Sheet</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost_per_sheet}
                onChange={(e) => setFormData({ ...formData, cost_per_sheet: e.target.value })}
                placeholder="12.99"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="Woodpeckers"
              />
            </div>
            <div className="space-y-2">
              <Label>Low Stock Alert</Label>
              <Input
                type="number"
                min="1"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 5 })}
              />
            </div>
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
              {materialType ? "Save Changes" : "Add Material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}