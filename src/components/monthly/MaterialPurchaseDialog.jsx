import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Check, ChevronsUpDown } from "lucide-react";
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
  const [openMaterialCombo, setOpenMaterialCombo] = useState(false);
  const [openVendorCombo, setOpenVendorCombo] = useState(false);

  const queryClient = useQueryClient();

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes"],
    queryFn: () => base44.entities.MaterialType.list(),
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => base44.entities.InventoryItem.list(),
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases"],
    queryFn: () => base44.entities.MaterialPurchase.list("-purchase_date", 100),
  });

  // Get unique material names
  const existingMaterialNames = Array.from(
    new Set([
      ...materialTypes.map(t => t.name),
      ...inventoryItems.map(i => i.material_name)
    ])
  ).filter(Boolean).sort();

  // Get unique vendor names
  const existingVendors = Array.from(
    new Set(materialPurchases.map(p => p.vendor).filter(Boolean))
  ).sort();

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
            <Label>Material Name *</Label>
            <Popover open={openMaterialCombo} onOpenChange={setOpenMaterialCombo}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {formData.material_name || "Select or type material..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search or type new material..."
                    value={formData.material_name}
                    onValueChange={(value) => setFormData({ ...formData, material_name: value })}
                  />
                  <CommandEmpty>
                    <div className="p-2 text-sm">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setOpenMaterialCombo(false)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Use "{formData.material_name}"
                      </Button>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {existingMaterialNames.map((name) => (
                      <CommandItem
                        key={name}
                        onSelect={() => {
                          setFormData({ ...formData, material_name: name });
                          setOpenMaterialCombo(false);
                        }}
                      >
                        <Check
                          className={clsx(
                            "mr-2 h-4 w-4",
                            formData.material_name === name ? "opacity-100" : "opacity-0"
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
            <Label>Vendor</Label>
            <Popover open={openVendorCombo} onOpenChange={setOpenVendorCombo}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {formData.vendor || "Select or type vendor..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search or type new vendor..."
                    value={formData.vendor}
                    onValueChange={(value) => setFormData({ ...formData, vendor: value })}
                  />
                  <CommandEmpty>
                    <div className="p-2 text-sm">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setOpenVendorCombo(false)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Use "{formData.vendor}"
                      </Button>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {existingVendors.map((vendor) => (
                      <CommandItem
                        key={vendor}
                        onSelect={() => {
                          setFormData({ ...formData, vendor });
                          setOpenVendorCombo(false);
                        }}
                      >
                        <Check
                          className={clsx(
                            "mr-2 h-4 w-4",
                            formData.vendor === vendor ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {vendor}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
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