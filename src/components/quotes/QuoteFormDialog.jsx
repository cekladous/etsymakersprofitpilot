import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
import { Plus, Trash2 } from "lucide-react";

const generateQuoteNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${year}${month}${random}`;
};

export default function QuoteFormDialog({ open, onOpenChange, quote }) {
  const [formData, setFormData] = useState({
    quote_number: generateQuoteNumber(),
    project_name: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    due_date: "",
    status: "Draft",
    line_items: [],
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    total: 0,
    notes: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (quote) {
      setFormData(quote);
    } else {
      setFormData({
        quote_number: generateQuoteNumber(),
        project_name: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        due_date: "",
        status: "Draft",
        line_items: [],
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: 0,
        notes: "",
      });
    }
  }, [quote, open]);

  const calculateTotals = (items, taxRate) => {
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const tax_amount = (subtotal * taxRate) / 100;
    const total = subtotal + tax_amount;
    return { subtotal, tax_amount, total };
  };

  const addLineItem = () => {
    const newItems = [...formData.line_items, { description: "", quantity: 1, unit_price: 0, total: 0 }];
    setFormData({ ...formData, line_items: newItems });
  };

  const updateLineItem = (index, field, value) => {
    const newItems = [...formData.line_items];
    newItems[index][field] = value;
    
    // Recalculate item total
    if (field === "quantity" || field === "unit_price") {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const price = parseFloat(newItems[index].unit_price) || 0;
      newItems[index].total = qty * price;
    }

    // Recalculate quote totals
    const { subtotal, tax_amount, total } = calculateTotals(newItems, formData.tax_rate);
    setFormData({
      ...formData,
      line_items: newItems,
      subtotal,
      tax_amount,
      total,
    });
  };

  const removeLineItem = (index) => {
    const newItems = formData.line_items.filter((_, i) => i !== index);
    const { subtotal, tax_amount, total } = calculateTotals(newItems, formData.tax_rate);
    setFormData({
      ...formData,
      line_items: newItems,
      subtotal,
      tax_amount,
      total,
    });
  };

  const updateTaxRate = (rate) => {
    const taxRate = parseFloat(rate) || 0;
    const { subtotal, tax_amount, total } = calculateTotals(formData.line_items, taxRate);
    setFormData({
      ...formData,
      tax_rate: taxRate,
      tax_amount,
      total,
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (quote) {
        return base44.entities.Quote.update(quote.id, data);
      } else {
        return base44.entities.Quote.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote" : "New Quote"}</DialogTitle>
          <div className="text-sm text-stone-500">
            Quote #{formData.quote_number}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Project Name *</Label>
                <Input
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="New Quote"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div>
                  <Label>Customer Email</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Accepted">Accepted</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Line Items</CardTitle>
                <Button type="button" onClick={addLineItem} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.line_items.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">
                  No items yet. Add one to calculate the total.
                </p>
              ) : (
                <div className="space-y-3">
                  {formData.line_items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start bg-stone-50 p-3 rounded-lg">
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                          <Input
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, "description", e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                            className="text-sm"
                            min="0"
                            step="1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder="Price"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                            className="text-sm"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-3">
                          <div className="h-9 flex items-center justify-end px-3 bg-white border rounded-md text-sm font-semibold">
                            ${(item.total || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        className="text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span className="font-semibold">${formData.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span>Tax:</span>
                        <Input
                          type="number"
                          value={formData.tax_rate}
                          onChange={(e) => updateTaxRate(e.target.value)}
                          className="w-20 h-7 text-sm"
                          min="0"
                          step="0.1"
                        />
                        <span className="text-stone-500">%</span>
                      </div>
                      <span className="font-semibold">${formData.tax_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span>${formData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add payment terms, delivery details, or a personalized message..."
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : quote ? "Update Quote" : "Create Quote"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}