import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Package, Clock } from "lucide-react";
import CustomerSearchSelect from "@/components/customers/CustomerSearchSelect";

const generateInvoiceNumber = () => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${random}`;
};

export default function InvoiceFormDialog({ open, onOpenChange, invoice }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    invoice_number: "",
    project_name: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_state: "",
    invoice_date: "",
    due_date: "",
    status: "Sent",
    notes: "",
    materials: [],
    machines: [],
    labor_hours: 0,
    labor_minutes: 0,
    labor_rate: 0,
    shipping_cost: 0,
    payment_method: "",
    line_items: [],
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    total: 0,
    amount_paid: 0,
    balance_due: 0,
  });

  useEffect(() => {
    if (invoice) {
      setFormData({
        ...invoice,
        materials: invoice.materials || [],
        machines: invoice.machines || [],
        labor_hours: invoice.labor_hours || 0,
        labor_minutes: invoice.labor_minutes || 0,
        labor_rate: invoice.labor_rate || 0,
        shipping_cost: invoice.shipping_cost || 0,
        payment_method: invoice.payment_method || "",
        line_items: invoice.line_items || [],
      });
    } else {
      setFormData({
        invoice_number: generateInvoiceNumber(),
        project_name: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        customer_state: "",
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: "",
        status: "Sent",
        notes: "",
        materials: [],
        machines: [],
        labor_hours: 0,
        labor_minutes: 0,
        labor_rate: 0,
        shipping_cost: 0,
        payment_method: "",
        line_items: [],
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: 0,
        amount_paid: 0,
        balance_due: 0,
      });
    }
  }, [invoice, open]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (invoice) {
        return base44.entities.Invoice.update(invoice.id, data);
      } else {
        return base44.entities.Invoice.create({ ...data, owner_user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {invoice ? "Edit Invoice" : "Create Invoice"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-stone-600" />
                <CardTitle className="text-base">Customer & Project</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-stone-600">Invoice Number</Label>
                  <Input
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="mt-1 font-mono"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-stone-600">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Sent">Sent</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-stone-600">Project Name</Label>
                <Input
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g. Custom Acrylic Sign"
                  required
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-stone-600">Invoice Date</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-stone-600">Due Date</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-stone-600">Select Customer</Label>
                <CustomerSearchSelect
                  value={formData.customer_id}
                  onChange={(customer) => {
                    if (customer) {
                      setFormData({
                        ...formData,
                        customer_id: customer.id,
                        customer_name: customer.name,
                        customer_email: customer.email || "",
                        customer_phone: customer.phone || "",
                      });
                    }
                  }}
                  placeholder="Search existing customers..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-stone-600">Customer Name</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-stone-600">Email</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-stone-600">Payment Method</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="etsy">Etsy</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-stone-600">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Payment terms, delivery details, or personalized message"
                  rows={3}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-stone-600" />
                <CardTitle className="text-base">Materials</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {formData.materials && formData.materials.length > 0 ? (
                <div className="space-y-2">
                  {formData.materials.map((material, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{material.name || material.type}</span>
                      {material.cost && <span className="text-stone-500 ml-2">${material.cost.toFixed(2)}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">No materials listed</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-stone-600" />
                <CardTitle className="text-base">Labor & Machine Time</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div className="mb-2">
                  <span className="font-medium">Labor:</span> {formData.labor_hours || 0}h {(formData.labor_minutes || 0)}m
                  {formData.labor_rate && <span className="text-stone-500 ml-2">@ ${formData.labor_rate}/hr</span>}
                </div>
                {formData.machines && formData.machines.length > 0 ? (
                  formData.machines.map((machine, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{machine.name}</span>: {machine.hours || 0}h {machine.minutes || 0}m
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">No machine time listed</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="bg-stone-800 text-white p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-lg font-semibold">Subtotal</span>
              <span className="text-xl font-bold">${(formData.subtotal || 0).toFixed(2)}</span>
            </div>
            {formData.tax_amount > 0 && (
              <div className="flex justify-between items-center mb-2 text-stone-300">
                <span>Tax ({formData.tax_rate || 0}%)</span>
                <span>${(formData.tax_amount || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-stone-600">
              <span className="text-2xl font-bold">Total</span>
              <span className="text-3xl font-bold">${(formData.total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-stone-300">
              <span>Amount Paid</span>
              <span>${(formData.amount_paid || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-1 text-emerald-300 font-semibold">
              <span>Balance Due</span>
              <span>${(formData.balance_due || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1 bg-stone-800 hover:bg-stone-900">
              {saveMutation.isPending ? "Saving..." : invoice ? "Update Invoice" : "Save Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}