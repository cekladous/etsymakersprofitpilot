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
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy } from "lucide-react";

export default function LaserSettingEditDialog({ setting, open, onOpenChange }) {
  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    laser_type: "",
    material_category: "",
    material_name: "",
    thickness_mm: "",
    operation: "",
    speed_mm_s: "",
    power_min_pct: "",
    power_max_pct: "",
    passes: 1,
    dpi_lpi: "",
    frequency_hz: "",
    notes: "",
    source_type: "User",
    copied_from_id: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (setting) {
      setFormData({
        brand: setting.brand || "",
        model: setting.model || "",
        laser_type: setting.laser_type || "",
        material_category: setting.material_category || "",
        material_name: setting.material_name || "",
        thickness_mm: setting.thickness_mm || "",
        operation: setting.operation || "",
        speed_mm_s: setting.speed_mm_s || "",
        power_min_pct: setting.power_min_pct || "",
        power_max_pct: setting.power_max_pct || "",
        passes: setting.passes || 1,
        dpi_lpi: setting.dpi_lpi || "",
        frequency_hz: setting.frequency_hz || "",
        notes: setting.notes || "",
        source_type: "User",
        copied_from_id: setting.id || "",
      });
    }
  }, [setting]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LaserSetting.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laser-settings"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      thickness_mm: formData.thickness_mm ? parseFloat(formData.thickness_mm) : null,
      speed_mm_s: formData.speed_mm_s ? parseFloat(formData.speed_mm_s) : null,
      power_min_pct: formData.power_min_pct ? parseFloat(formData.power_min_pct) : null,
      power_max_pct: formData.power_max_pct ? parseFloat(formData.power_max_pct) : null,
      passes: formData.passes ? parseInt(formData.passes) : 1,
      dpi_lpi: formData.dpi_lpi ? parseFloat(formData.dpi_lpi) : null,
      frequency_hz: formData.frequency_hz ? parseFloat(formData.frequency_hz) : null,
    };
    createMutation.mutate(payload);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-emerald-600" />
            <DialogTitle>Save as My Setting</DialogTitle>
          </div>
          <DialogDescription>
            Copy and customize this setting for your personal library
            {setting?.source_type && (
              <Badge className="ml-2 capitalize">{setting.source_type}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Input
                value={formData.brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Model *</Label>
              <Input
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Laser Type *</Label>
              <Input
                value={formData.laser_type}
                onChange={(e) => handleChange("laser_type", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Operation *</Label>
              <Input
                value={formData.operation}
                onChange={(e) => handleChange("operation", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Material Category *</Label>
              <Input
                value={formData.material_category}
                onChange={(e) => handleChange("material_category", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Material Name</Label>
              <Input
                value={formData.material_name}
                onChange={(e) => handleChange("material_name", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Thickness (mm)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.thickness_mm}
                onChange={(e) => handleChange("thickness_mm", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Speed (mm/s)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.speed_mm_s}
                onChange={(e) => handleChange("speed_mm_s", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Passes</Label>
              <Input
                type="number"
                value={formData.passes}
                onChange={(e) => handleChange("passes", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Power Min (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.power_min_pct}
                onChange={(e) => handleChange("power_min_pct", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Power Max (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.power_max_pct}
                onChange={(e) => handleChange("power_max_pct", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>DPI/LPI</Label>
              <Input
                type="number"
                value={formData.dpi_lpi}
                onChange={(e) => handleChange("dpi_lpi", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frequency (Hz)</Label>
            <Input
              type="number"
              value={formData.frequency_hz}
              onChange={(e) => handleChange("frequency_hz", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              placeholder="Add any custom notes about this setting..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save to My Settings
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}