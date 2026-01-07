import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function CustomSaleDialog({ open, onOpenChange }) {
  const [formData, setFormData] = useState({
    sale_type: "A",
    date: new Date().toISOString().split("T")[0],
    pre_tax_amount: "",
    sales_tax_collected: 0,
    vendor: "",
    description: "",
    payment_source: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const gross_sale = parseFloat(data.pre_tax_amount || 0) + parseFloat(data.sales_tax_collected || 0);
      return base44.entities.CustomSale.create({
        ...data,
        pre_tax_amount: parseFloat(data.pre_tax_amount || 0),
        sales_tax_collected: parseFloat(data.sales_tax_collected || 0),
        gross_sale,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
      onOpenChange(false);
      setFormData({
        sale_type: "A",
        date: new Date().toISOString().split("T")[0],
        pre_tax_amount: "",
        sales_tax_collected: 0,
        vendor: "",
        description: "",
        payment_source: "",
        notes: "",
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
          <DialogTitle>Add Custom Sale</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sale Type *</Label>
              <Select
                value={formData.sale_type}
                onValueChange={(v) => setFormData({ ...formData, sale_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Custom Sale A</SelectItem>
                  <SelectItem value="B">Custom Sale B</SelectItem>
                  <SelectItem value="C">Custom Sale C</SelectItem>
                  <SelectItem value="D">Custom Sale D</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
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
            <Label>Vendor/Customer</Label>
            <Input
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              placeholder="Customer name"
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

          <div className="space-y-2">
            <Label>Payment Source</Label>
            <Input
              value={formData.payment_source}
              onChange={(e) => setFormData({ ...formData, payment_source: e.target.value })}
              placeholder="Cash, Check, Venmo, etc."
            />
          </div>

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