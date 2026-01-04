import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { calculateProfit, formatCurrency } from "@/components/shared/profitCalculator";
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

export default function OrderFormDialog({ open, onOpenChange, order, onClose }) {
  const [formData, setFormData] = useState({
    channel: "etsy",
    order_id: "",
    sale_date: "",
    sku: "",
    product_name: "",
    quantity: 1,
    gross_total: 0,
    shipping_charged: 0,
    discounts: 0,
    refunds: 0,
    sales_tax: 0,
    etsy_fees: 0,
    processing_fees: 0,
    net_payout: 0,
    status: "pending",
    notes: "",
  });

  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });

  // Calculate auto fees if not manually entered
  const autoCalculateFees = () => {
    if (!formData.gross_total) return;
    
    const result = calculateProfit({
      sales_price: formData.gross_total || 0,
      shipping_charged: formData.shipping_charged || 0,
      discounts: formData.discounts || 0,
      refunds: formData.refunds || 0,
      sales_tax: formData.sales_tax || 0,
      cost_of_goods: 0,
    }, settings[0]);

    setFormData(prev => ({
      ...prev,
      etsy_fees: result.listing_fee + result.transaction_fee,
      processing_fees: result.processing_fee,
      net_payout: result.net_revenue,
    }));
  };

  useEffect(() => {
    if (order) {
      setFormData({
        channel: order.channel || "etsy",
        order_id: order.order_id || "",
        sale_date: order.sale_date || "",
        sku: order.sku || "",
        product_name: order.product_name || "",
        quantity: order.quantity || 1,
        gross_total: order.gross_total || 0,
        shipping_charged: order.shipping_charged || 0,
        discounts: order.discounts || 0,
        refunds: order.refunds || 0,
        sales_tax: order.sales_tax || 0,
        etsy_fees: order.etsy_fees || 0,
        processing_fees: order.processing_fees || 0,
        net_payout: order.net_payout || 0,
        status: order.status || "pending",
        notes: order.notes || "",
      });
    } else {
      setFormData({
        channel: "etsy",
        order_id: "",
        sale_date: "",
        sku: "",
        product_name: "",
        quantity: 1,
        gross_total: 0,
        shipping_charged: 0,
        discounts: 0,
        refunds: 0,
        sales_tax: 0,
        etsy_fees: 0,
        processing_fees: 0,
        net_payout: 0,
        status: "pending",
        notes: "",
      });
    }
  }, [order]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (order) {
        return base44.entities.Order.update(order.id, data);
      }
      return base44.entities.Order.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Edit Order" : "Add Order"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={formData.channel}
                onValueChange={(v) => handleChange("channel", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="etsy">Etsy</SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order ID *</Label>
              <Input
                value={formData.order_id}
                onChange={(e) => handleChange("order_id", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sale Date</Label>
              <Input
                type="date"
                value={formData.sale_date}
                onChange={(e) => handleChange("sale_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_production">In Production</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => handleChange("sku", e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Product Name</Label>
              <Input
                value={formData.product_name}
                onChange={(e) => handleChange("product_name", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => handleChange("quantity", parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Financial Info */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-stone-900">Financials</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autoCalculateFees}
              >
                Auto-Calculate Fees
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Gross Total</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.gross_total}
                  onChange={(e) => handleChange("gross_total", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Shipping</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.shipping_charged}
                  onChange={(e) => handleChange("shipping_charged", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Discounts</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.discounts}
                  onChange={(e) => handleChange("discounts", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Refunds</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.refunds}
                  onChange={(e) => handleChange("refunds", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Sales Tax</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.sales_tax}
                  onChange={(e) => handleChange("sales_tax", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Etsy Fees</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.etsy_fees}
                  onChange={(e) => handleChange("etsy_fees", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Processing Fees</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.processing_fees}
                  onChange={(e) => handleChange("processing_fees", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Net Payout</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.net_payout}
                  onChange={(e) => handleChange("net_payout", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
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
              {order ? "Save Changes" : "Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}