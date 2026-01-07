import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const EXPENSE_CATEGORIES = [
  { group: "selling_expenses", name: "etsy_listing_fees", label: "Etsy Listing Fees" },
  { group: "selling_expenses", name: "etsy_transaction_fees", label: "Etsy Transaction Fees" },
  { group: "selling_expenses", name: "etsy_processing_fees", label: "Etsy Processing Fees" },
  { group: "selling_expenses", name: "share_save_refunds_credits", label: "Share & Save Refunds & Credits" },
  { group: "selling_expenses", name: "other_fees", label: "Other Fees" },
  { group: "selling_expenses", name: "etsy_ads", label: "Etsy Ads" },
  { group: "selling_expenses", name: "etsy_offsite_ads_fees", label: "Etsy Offsite Ads Fees" },
  { group: "selling_expenses", name: "etsy_shipping", label: "Etsy Shipping" },
  { group: "selling_expenses", name: "other_postage_costs", label: "Other Postage Costs" },
  { group: "selling_expenses", name: "custom_expense_a", label: "Custom Expense A (Selling)" },
  { group: "selling_expenses", name: "custom_expense_b", label: "Custom Expense B (Selling)" },
  { group: "product_expenses", name: "materials_supplies", label: "Materials & Supplies" },
  { group: "product_expenses", name: "tools_equipment", label: "Tools & Equipment" },
  { group: "business_expenses", name: "advertising_marketing", label: "Advertising & Marketing" },
  { group: "business_expenses", name: "office_expenses", label: "Office Expenses" },
  { group: "business_expenses", name: "professional_services", label: "Professional Services" },
  { group: "business_expenses", name: "other", label: "Other" },
  { group: "business_expenses", name: "miscellaneous_expenses", label: "Miscellaneous Expenses" },
  { group: "business_expenses", name: "custom_expense_c", label: "Custom Expense C (Business)" },
];

export default function BusinessExpenseDialog({ open, onOpenChange, preselectedCategory = null }) {
  const queryClient = useQueryClient();
  
  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });
  
  const appSettings = settings[0] || {};
  const customExpenseALabel = appSettings.custom_expense_a_label || "Custom Expense A";
  const customExpenseBLabel = appSettings.custom_expense_b_label || "Custom Expense B";
  
  // Update category labels with custom names
  const categoryOptions = EXPENSE_CATEGORIES.map(cat => {
    if (cat.name === "custom_expense_a") return { ...cat, label: customExpenseALabel };
    if (cat.name === "custom_expense_b") return { ...cat, label: customExpenseBLabel };
    return cat;
  });
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category_name: preselectedCategory || "materials_supplies",
    amount: "",
    vendor: "",
    description: "",
    payment_source: "",
    notes: "",
    inventory_flag: false,
    budget_amount: "",
  });

  // Update category when preselectedCategory changes
  React.useEffect(() => {
    if (preselectedCategory && open) {
      setFormData(prev => ({ ...prev, category_name: preselectedCategory }));
    }
  }, [preselectedCategory, open]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const category = EXPENSE_CATEGORIES.find(c => c.name === data.category_name);
      const expense = await base44.entities.BusinessExpense.create({
        ...data,
        category_group: category?.group || "business_expenses",
        amount: parseFloat(data.amount || 0),
        budget_amount: parseFloat(data.budget_amount || 0),
        inventory_flag: data.inventory_flag || false,
      });
      
      // Auto-deduct from inventory if flagged
      if (data.inventory_flag && data.category_name === "materials_supplies") {
        try {
          const { processInventoryUsage } = await import("../inventory/inventoryHelpers");
          await processInventoryUsage(expense);
          queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
        } catch (error) {
          console.error("Failed to update inventory:", error);
        }
      }
      
      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-expenses"] });
      onOpenChange(false);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        category_name: "materials_supplies",
        amount: "",
        vendor: "",
        description: "",
        payment_source: "",
        notes: "",
        inventory_flag: false,
        budget_amount: "",
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Business Expense</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Select
              value={formData.category_name}
              onValueChange={(v) => setFormData({ ...formData, category_name: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vendor</Label>
            <Input
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              placeholder="Vendor name"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Expense details"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Source</Label>
              <Select
                value={formData.payment_source}
                onValueChange={(v) => setFormData({ ...formData, payment_source: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Zelle">Zelle</SelectItem>
                  <SelectItem value="Venmo">Venmo</SelectItem>
                  <SelectItem value="Square">Square</SelectItem>
                  <SelectItem value="PayPal">PayPal</SelectItem>
                  <SelectItem value="Etsy">Etsy</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Budget (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.budget_amount}
                onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
              />
            </div>
          </div>

          {formData.category_name === "materials_supplies" && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.inventory_flag}
                onCheckedChange={(checked) => setFormData({ ...formData, inventory_flag: checked })}
                id="inventory_flag"
              />
              <Label htmlFor="inventory_flag" className="cursor-pointer">
                Mark as Inventory
              </Label>
            </div>
          )}

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
              Add Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}