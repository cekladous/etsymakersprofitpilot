import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

export default function QuickCustomerForm({ onCustomerCreated, onCancel }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCustomerCreated(customer);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createMutation.mutate(formData);
  };

  return (
    <Card className="p-4 bg-emerald-50 border border-emerald-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-emerald-900">Create New Customer</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-6 w-6 text-emerald-600 hover:text-emerald-900"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label className="text-xs text-emerald-900">Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Customer name"
            className="mt-1 h-8 text-sm"
            required
          />
        </div>

        <div>
          <Label className="text-xs text-emerald-900">Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@example.com"
            className="mt-1 h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs text-emerald-900">Phone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
            className="mt-1 h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs text-emerald-900">Company</Label>
          <Input
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            placeholder="Company name (optional)"
            className="mt-1 h-8 text-sm"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex-1 h-8"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700"
          >
            {createMutation.isPending ? "Creating..." : "Add Customer"}
          </Button>
        </div>
      </form>
    </Card>
  );
}