import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import CustomerSearchSelect from "@/components/customers/CustomerSearchSelect";

export default function CustomSaleDialog({ open, onOpenChange }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState("");
  
  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
  });
  
  const appSettings = settings[0] || {};
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    pre_tax_amount: "",
    sales_tax_collected: "",
    shipping_or_postage_cost: "",
    vendor: "",
    customer_id: "",
    description: "",
    payment_source: "",
    sales_source: "Other",
    notes: "",
    budget_amount: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const gross_sale = parseFloat(data.pre_tax_amount || 0) + parseFloat(data.sales_tax_collected || 0);

      // Auto-create a Customer from vendor name if no customer was selected
      let customerId = data.customer_id;
      if (!customerId && data.vendor?.trim()) {
        try {
          const vendorName = data.vendor.trim();
          const existing = await base44.entities.Customer.filter({
            owner_user_id: user.id,
            name: vendorName,
          });
          if (existing.length > 0) {
            customerId = existing[0].id;
          } else {
            const created = await base44.entities.Customer.create({
              owner_user_id: user.id,
              name: vendorName,
            });
            customerId = created.id;
          }
        } catch (err) {
          console.warn('Could not auto-create customer:', err.message);
        }
      }

      return base44.entities.CustomSale.create({
        ...data,
        customer_id: customerId || "",
        owner_user_id: user.id,
        pre_tax_amount: parseFloat(data.pre_tax_amount || 0),
        sales_tax_collected: parseFloat(data.sales_tax_collected || 0),
        gross_sale,
        shipping_or_postage_cost: parseFloat(data.shipping_or_postage_cost || 0),
        budget_amount: parseFloat(data.budget_amount || 0),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
      setErrorMessage("");
      setFormData({
        date: new Date().toISOString().split("T")[0],
        pre_tax_amount: "",
        sales_tax_collected: "",
        shipping_or_postage_cost: "",
        vendor: "",
    customer_id: "",
        description: "",
        payment_source: "",
        sales_source: "Other",
        notes: "",
      });
    },
    onError: (error) => {
      setErrorMessage(error?.message || "Failed to save sale. Please try again.");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Sale</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pre-Tax Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.pre_tax_amount}
                onChange={(e) => setFormData({ ...formData, pre_tax_amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Sales Tax Collected</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.sales_tax_collected}
                onChange={(e) => setFormData({ ...formData, sales_tax_collected: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sales Source</Label>
            <Select
              value={formData.sales_source}
              onValueChange={(v) => setFormData({ ...formData, sales_source: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Squarespace">Squarespace</SelectItem>
                <SelectItem value="Square">Square</SelectItem>
                <SelectItem value="In-Person/Cash">In-Person/Cash</SelectItem>
                <SelectItem value="Website">Website</SelectItem>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Customer</Label>
            <CustomerSearchSelect
              value={formData.customer_id}
              onChange={(customer) => {
                if (customer) {
                  setFormData({ ...formData, customer_id: customer.id, vendor: customer.name });
                }
              }}
              placeholder="Search customers..."
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Sale details"
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
              <Label>Shipping/Postage Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.shipping_or_postage_cost}
                onChange={(e) => setFormData({ ...formData, shipping_or_postage_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details"
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}