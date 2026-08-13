import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
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
import { Loader2, Check, ChevronsUpDown, Sparkles } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { clsx } from "clsx";

export default function MaterialTypeDialog({ open, onOpenChange, materialType, onClose }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    category: "wood",
    thickness: "",
    default_width: "",
    default_height: "",
    cost_per_sheet: "",
    supplier: "",
    reorder_url: "",
    low_stock_threshold: 5,
    notes: "",
  });
  const [openNameCombo, setOpenNameCombo] = useState(false);

  const queryClient = useQueryClient();

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes"],
    queryFn: () => base44.entities.MaterialType.list(),
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => base44.entities.InventoryItem.list(),
  });

  const currentInventory = materialType 
    ? inventoryItems.find(i => i.material_name === materialType.name)
    : null;

  // Get all unique material names for dropdown
  const existingMaterialNames = Array.from(
    new Set([
      ...materialTypes.map(t => t.name),
      ...inventoryItems.map(i => i.material_name)
    ])
  ).filter(Boolean).sort();

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
        reorder_url: materialType.reorder_url || "",
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
        reorder_url: "",
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
      return base44.entities.MaterialType.create({ ...payload, owner_user_id: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
      onClose();
    },
  });

  const [aiLoading, setAiLoading] = useState(false);

  const autoFillWithAI = async () => {
    const { name, reorder_url } = formData;
    if (!name && !reorder_url) return;

    setAiLoading(true);
    try {
      const hasUrl = reorder_url && /^https?:\/\//i.test(reorder_url);
      const prompt = hasUrl
        ? `Visit this product/material page URL and extract the details for inventory tracking: ${reorder_url}. ${
            name ? `The material is listed as "${name}" if visible. ` : ""
          }Return the material name, category (one of: wood, acrylic, leather, paper, fabric, other), thickness (e.g. "1/8"), sheet width and height in inches, cost per sheet in USD, and the supplier/vendor name. If a field isn't found, return null for it.`
        : `A maker is adding a material to inventory named "${name}". Based on the name, determine the best category (one of: wood, acrylic, leather, paper, fabric, other), a likely thickness (e.g. "1/8", "3mm"), typical sheet width and height in inches, and an estimated cost per sheet in USD. Return only what you can reasonably infer; null for anything uncertain.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: hasUrl,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: ["wood", "acrylic", "leather", "paper", "fabric", "other"] },
            thickness: { type: "string" },
            default_width: { type: "number" },
            default_height: { type: "number" },
            cost_per_sheet: { type: "number" },
            supplier: { type: "string" },
          },
        },
      });

      const extracted = res || {};
      setFormData((prev) => ({
        ...prev,
        name: extracted.name || prev.name,
        category: extracted.category || prev.category,
        thickness: extracted.thickness || prev.thickness,
        default_width: extracted.default_width != null ? String(extracted.default_width) : prev.default_width,
        default_height: extracted.default_height != null ? String(extracted.default_height) : prev.default_height,
        cost_per_sheet: extracted.cost_per_sheet != null ? String(extracted.cost_per_sheet) : prev.cost_per_sheet,
        supplier: extracted.supplier || prev.supplier,
      }));
    } catch (err) {
      console.error("AI auto-fill failed", err);
    } finally {
      setAiLoading(false);
    }
  };

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
          <Button
            type="button"
            variant="outline"
            onClick={autoFillWithAI}
            disabled={aiLoading || (!formData.name && !formData.reorder_url)}
            className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {aiLoading
              ? "Extracting with AI..."
              : formData.reorder_url
              ? "Extract Details from Link"
              : "Auto-Categorize with AI"}
          </Button>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Material Name *</Label>
              <Popover open={openNameCombo} onOpenChange={setOpenNameCombo}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {formData.name || "Select or type material name..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or type new material..."
                      value={formData.name}
                      onValueChange={(value) => setFormData({ ...formData, name: value })}
                    />
                    <CommandEmpty>
                      <div className="p-2 text-sm">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => setOpenNameCombo(false)}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Use "{formData.name}"
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {existingMaterialNames.map((name) => (
                        <CommandItem
                          key={name}
                          onSelect={() => {
                            setFormData({ ...formData, name });
                            setOpenNameCombo(false);
                          }}
                        >
                          <Check
                            className={clsx(
                              "mr-2 h-4 w-4",
                              formData.name === name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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
                placeholder="Houston Acrylic, Amazon, etc."
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
            <Label>Reorder Link</Label>
            <Input
              type="url"
              value={formData.reorder_url}
              onChange={(e) => setFormData({ ...formData, reorder_url: e.target.value })}
              placeholder="https://www.houstonacrylic.com/..."
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

          {materialType && (
            <div className="p-4 rounded-lg border border-stone-200 bg-stone-50">
              <p className="text-sm font-semibold text-stone-700 mb-3">Current Inventory</p>
              {currentInventory ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-stone-600">Quantity on Hand:</span>
                    <span className={`font-semibold ${
                      currentInventory.quantity_on_hand === 0 
                        ? "text-rose-600" 
                        : currentInventory.quantity_on_hand <= (materialType.low_stock_threshold || 5)
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}>
                      {currentInventory.quantity_on_hand?.toFixed(2) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-stone-600">Average Cost:</span>
                    <span className="font-medium text-stone-900">
                      ${currentInventory.average_cost?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-stone-600">Total Value:</span>
                    <span className="font-semibold text-stone-900">
                      ${currentInventory.total_value?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-sm text-stone-500">Inventory: 0</p>
                  <p className="text-xs text-stone-400 mt-1">(No inventory recorded yet)</p>
                </div>
              )}
            </div>
          )}

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