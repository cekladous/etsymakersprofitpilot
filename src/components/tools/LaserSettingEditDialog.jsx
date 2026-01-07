import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const machines = [
  { brand: "atomstack", label: "Atomstack", models: ["A5 M50", "A10 Pro", "A20 Pro", "X7 Pro", "S10 Pro", "P7 M40", "Other"] },
  { brand: "boss", label: "Boss Laser", models: ["LS-1416", "LS-1630", "HP-1610", "HP-2440", "LS-2436", "Other"] },
  { brand: "creality", label: "Creality", models: ["Falcon", "Falcon 2", "CV-30", "Other"] },
  { brand: "epilog", label: "Epilog", models: ["Zing 16", "Zing 24", "Fusion Pro", "Fusion Edge", "Other"] },
  { brand: "fsl", label: "Full Spectrum Laser", models: ["Muse", "H-Series", "Pro Series", "Other"] },
  { brand: "generic", label: "Generic/K40", models: ["K40", "Generic CO2", "Generic Diode", "Other"] },
  { brand: "glowforge", label: "Glowforge", models: ["Basic", "Plus", "Pro", "Aura", "Other"] },
  { brand: "laserpecker", label: "LaserPecker", models: ["LP3", "LP4", "L1 Pro", "L2", "Other"] },
  { brand: "longer", label: "Longer", models: ["Ray5", "Laser B1", "Other"] },
  { brand: "monport", label: "Monport", models: ["40W", "50W", "60W", "80W", "100W", "Other"] },
  { brand: "omtech", label: "OMTech", models: ["40W", "50W", "60W", "80W", "100W", "130W", "Other"] },
  { brand: "ortur", label: "Ortur", models: ["LM2", "LM3", "Laser Master 3", "H10", "Other"] },
  { brand: "thunder", label: "Thunder Laser", models: ["Nova 24", "Nova 35", "Nova 51", "Odin", "Other"] },
  { brand: "trotec", label: "Trotec", models: ["Speedy 100", "Speedy 300", "Speedy 400", "SP500", "Other"] },
  { brand: "wecreat", label: "WeCreat", models: ["Vision", "Other"] },
  { brand: "xtool", label: "xTool", models: ["D1", "D1 Pro", "M1", "P2", "P3", "S1", "F1", "F1 Ultra", "Other"] },
  { brand: "other", label: "Other", models: ["Custom"] },
];

const materialCategories = [
  "Wood", "Plywood", "MDF", "Acrylic", "Leather", "Paper", "Cardboard", 
  "Fabric", "Foam", "Rubber", "Glass", "Metal", "Stone", "Tile", "Food"
];

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

  const saveMutation = useMutation({
    mutationFn: (data) => {
      // If editing a User setting, update it. Otherwise create new
      if (setting?.source_type === "User" && setting?.id) {
        return base44.entities.LaserSetting.update(setting.id, data);
      }
      return base44.entities.LaserSetting.create(data);
    },
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
    saveMutation.mutate(payload);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectedMachine = machines.find(m => m.brand === formData.brand);
  const availableModels = selectedMachine?.models || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-emerald-600" />
            <DialogTitle>
              {setting?.source_type === "User" && setting?.id ? "Edit My Setting" : "Save as My Setting"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {setting?.source_type === "User" && setting?.id 
              ? "Edit your custom laser setting"
              : "Copy and customize this setting for your personal library"}
            {setting?.source_type && (
              <Badge className="ml-2 capitalize">{setting.source_type}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Select
                value={formData.brand}
                onValueChange={(value) => {
                  handleChange("brand", value);
                  handleChange("model", "");
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select brand..." />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((machine) => (
                    <SelectItem key={machine.brand} value={machine.brand}>
                      {machine.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model *</Label>
              <Select
                value={formData.model}
                onValueChange={(value) => handleChange("model", value)}
                required
                disabled={!formData.brand}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Laser Type *</Label>
              <Select
                value={formData.laser_type}
                onValueChange={(value) => handleChange("laser_type", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select laser type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="co2">CO2</SelectItem>
                  <SelectItem value="diode">Diode</SelectItem>
                  <SelectItem value="fiber">Fiber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operation *</Label>
              <Select
                value={formData.operation}
                onValueChange={(value) => handleChange("operation", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select operation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cut">Cut</SelectItem>
                  <SelectItem value="engrave">Engrave</SelectItem>
                  <SelectItem value="score">Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Material Category *</Label>
              <Select
                value={formData.material_category}
                onValueChange={(value) => handleChange("material_category", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select material..." />
                </SelectTrigger>
                <SelectContent>
                  {materialCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={saveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {setting?.source_type === "User" && setting?.id ? "Update Setting" : "Save to My Settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}