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

export default function MaterialSheetDialog({ open, onOpenChange, sheet, materialTypes, onClose }) {
  const [formData, setFormData] = useState({
    material_type_id: "",
    width: "",
    height: "",
    cost: "",
    purchase_date: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (sheet) {
      setFormData({
        material_type_id: sheet.material_type_id || "",
        width: sheet.width?.toString() || "",
        height: sheet.height?.toString() || "",
        cost: sheet.cost?.toString() || "",
        purchase_date: sheet.purchase_date || "",
        notes: sheet.notes || "",
      });
    } else {
      setFormData({
        material_type_id: "",
        width: "",
        height: "",
        cost: "",
        purchase_date: "",
        notes: "",
      });
    }
  }, [sheet]);

  // Auto-fill from material type
  useEffect(() => {
    if (formData.material_type_id && !sheet) {
      const type = materialTypes.find(t => t.id === formData.material_type_id);
      if (type) {
        setFormData(prev => ({
          ...prev,
          width: type.default_width?.toString() || prev.width,
          height: type.default_height?.toString() || prev.height,
          cost: type.cost_per_sheet?.toString() || prev.cost,
        }));
      }
    }
  }, [formData.material_type_id, materialTypes, sheet]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const width = parseFloat(data.width) || 0;
      const height = parseFloat(data.height) || 0;
      const cost = parseFloat(data.cost) || 0;
      const totalArea = width * height;

      const payload = {
        material_type_id: data.material_type_id,
        width,
        height,
        total_area: totalArea,
        remaining_area: sheet ? undefined : totalArea,
        remaining_percentage: sheet ? undefined : 100,
        cost,
        remaining_value: sheet ? undefined : cost,
        status: "available",
        purchase_date: data.purchase_date,
        notes: data.notes,
      };
      
      if (sheet) {
        return base44.entities.MaterialSheet.update(sheet.id, payload);
      }
      return base44.entities.MaterialSheet.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialSheets"] });
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
          <DialogTitle>{sheet ? "Edit Sheet" : "Add Sheet"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Material Type *</Label>
            <Select
              value={formData.material_type_id}
              onValueChange={(v) => setFormData({ ...formData, material_type_id: v })}
              required
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
              <Label>Width (in)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.width}
                onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Height (in)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purchase Date</Label>
            <Input
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
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
              {sheet ? "Save Changes" : "Add Sheet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}