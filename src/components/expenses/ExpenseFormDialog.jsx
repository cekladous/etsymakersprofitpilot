import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2 } from "lucide-react";

// Map legacy categories to BusinessExpense schema
const CATEGORY_MAP = {
  materials: "materials_supplies",
  shipping: "shipping_costs",
  tools: "tools_equipment",
  software: "software_subscriptions",
  advertising: "advertising_marketing",
  utilities: "utilities_cell_phone",
  etsy_fees: "etsy_transaction_fees",
  packaging: "packaging_materials",
  equipment: "tools_equipment",
  maintenance: "miscellaneous_expenses",
  other: "other"
};

const CATEGORIES = [
  { value: "materials_supplies", label: "Materials & Supplies" },
  { value: "packaging_materials", label: "Packaging" },
  { value: "tools_equipment", label: "Tools & Equipment" },
  { value: "software_subscriptions", label: "Software" },
  { value: "advertising_marketing", label: "Advertising" },
  { value: "utilities_cell_phone", label: "Utilities" },
  { value: "etsy_transaction_fees", label: "Etsy Fees" },
  { value: "shipping_costs", label: "Shipping" },
  { value: "miscellaneous_expenses", label: "Other" },
];

export default function ExpenseFormDialog({ open, onOpenChange, expense, onClose }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    date: "",
    description: "",
    amount: "",
    category: "miscellaneous_expenses",
    vendor: "",
    payment_method: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (expense) {
      // Handle both legacy and new BusinessExpense formats
      const category = expense.category_name || expense.category;
      setFormData({
        date: expense.date || "",
        description: expense.description || "",
        amount: expense.amount?.toString() || "",
        category: category || "miscellaneous_expenses",
        vendor: expense.vendor || "",
        payment_method: expense.payment_source || expense.payment_method || "",
        notes: expense.notes || "",
      });
    } else {
      setFormData({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        category: "miscellaneous_expenses",
        vendor: "",
        payment_method: "",
        notes: "",
      });
    }
  }, [expense]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        date: data.date,
        description: data.description,
        amount: parseFloat(data.amount) || 0,
        category_name: data.category,
        vendor: data.vendor,
        payment_source: data.payment_method,
        notes: data.notes,
      };
      
      if (expense && expense.source === "business") {
        return base44.entities.BusinessExpense.update(expense.id, payload);
      } else if (expense) {
        // Legacy expense - still update via Expense entity
        return base44.entities.Expense.update(expense.id, {
          ...data,
          amount: parseFloat(data.amount) || 0,
          is_categorized: true,
        });
      }
      // New expenses go to BusinessExpense
      return base44.entities.BusinessExpense.create({ 
        ...payload,
        owner_user_id: user.id 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["business-expenses"] });
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
          <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this expense for?"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                      {cat.value === "materials_supplies" && " (material purchases go here)"}
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
                placeholder="Amazon, Home Depot..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Input
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              placeholder="Credit card, PayPal..."
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
              {expense ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}