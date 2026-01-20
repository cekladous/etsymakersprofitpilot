import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function JobFormDialog({ open, onOpenChange, job, onClose }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    job_number: "",
    order_ids: [],
    product_id: "",
    quantity: 1,
    operations: [],
    material_cost: 0,
    machine_time_cost: 0,
    electricity_cost: 0,
    overhead_cost: 0,
    depreciation_cost: 0,
    status: "pending",
    notes: "",
  });
  const [orderSearch, setOrderSearch] = useState("");

  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Order.filter({ owner_user_id: user.id }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Product.filter({ owner_user_id: user.id }),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Machine.filter({ owner_user_id: user.id }),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
  });

  const availableOrders = orders
    .filter(o => !o.job_id || job?.order_ids?.includes(o.id))
    .filter(o => {
      if (!orderSearch) return true;
      const search = orderSearch.toLowerCase();
      return (
        o.order_id?.toLowerCase().includes(search) ||
        o.product_name?.toLowerCase().includes(search) ||
        o.sku?.toLowerCase().includes(search)
      );
    });

  useEffect(() => {
    if (job) {
      setFormData({
        job_number: job.job_number || "",
        order_ids: job.order_ids || [],
        product_id: job.product_id || "",
        quantity: job.quantity || 1,
        operations: job.operations || [],
        material_cost: job.material_cost || 0,
        machine_time_cost: job.machine_time_cost || 0,
        electricity_cost: job.electricity_cost || 0,
        overhead_cost: job.overhead_cost || 0,
        depreciation_cost: job.depreciation_cost || 0,
        status: job.status || "pending",
        notes: job.notes || "",
      });
    } else {
      const nextNumber = `JOB-${Date.now().toString().slice(-6)}`;
      setFormData({
        job_number: nextNumber,
        order_ids: [],
        product_id: "",
        quantity: 1,
        operations: [],
        material_cost: 0,
        machine_time_cost: 0,
        electricity_cost: 0,
        overhead_cost: 0,
        depreciation_cost: 0,
        status: "pending",
        notes: "",
      });
    }
    setOrderSearch("");
  }, [job, open]);

  const calculateCosts = () => {
    const appSettings = settings[0] || {};
    const electricityRate = appSettings.electricity_rate || 0.12;
    
    let totalMachineTime = 0;
    let totalElectricity = 0;
    
    formData.operations.forEach(op => {
      const machine = machines.find(m => m.id === op.machine_id);
      if (machine) {
        const hours = (op.duration_minutes || 0) / 60;
        totalMachineTime += hours * (machine.hourly_rate || 0);
        totalElectricity += hours * ((machine.wattage || 0) / 1000) * electricityRate;
      }
    });

    setFormData(prev => ({
      ...prev,
      machine_time_cost: Math.round(totalMachineTime * 100) / 100,
      electricity_cost: Math.round(totalElectricity * 100) / 100,
    }));
  };

  useEffect(() => {
    calculateCosts();
  }, [formData.operations, machines, settings]);

  const totalCost = 
    (formData.material_cost || 0) +
    (formData.machine_time_cost || 0) +
    (formData.electricity_cost || 0) +
    (formData.overhead_cost || 0) +
    (formData.depreciation_cost || 0);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, total_cost: totalCost };
      
      if (job) {
        // Update job
        const result = await base44.entities.Job.update(job.id, payload);
        
        // Update order links
        for (const orderId of data.order_ids) {
          await base44.entities.Order.update(orderId, { 
            job_id: job.id,
            status: data.status === "in_progress" ? "in_production" : undefined
          });
        }
        
        // If job is completed, create inventory transactions for material usage
        if (data.status === "completed" && data.material_cost > 0 && data.product_id) {
          try {
            const product = products.find(p => p.id === data.product_id);
            if (product && product.default_material_id) {
              const { data: inventoryItems } = await queryClient.fetchQuery({
                queryKey: ["inventory-items"],
                queryFn: () => base44.entities.InventoryItem.list(),
              });
              
              const materialType = await base44.entities.MaterialType.get(product.default_material_id);
              const inventoryItem = inventoryItems.find(i => i.material_name === materialType?.name);
              
              if (inventoryItem) {
                // Create usage transaction
                await base44.entities.InventoryTransaction.create({
                  owner_user_id: user.id,
                  inventory_item_id: inventoryItem.id,
                  transaction_date: new Date().toISOString().split("T")[0],
                  transaction_type: "usage",
                  quantity_change: -(data.quantity || 1),
                  unit_cost: inventoryItem.average_cost || 0,
                  reference_id: job.id,
                  notes: `Used for Job ${data.job_number}`,
                });
                
                // Update inventory quantities
                const newQuantity = Math.max(0, (inventoryItem.quantity_on_hand || 0) - (data.quantity || 1));
                await base44.entities.InventoryItem.update(inventoryItem.id, {
                  quantity_on_hand: newQuantity,
                  total_value: newQuantity * inventoryItem.average_cost,
                  last_updated: new Date().toISOString(),
                });
              }
            }
          } catch (error) {
            console.error("Failed to update inventory:", error);
          }
        }
        
        return result;
      }
      
      // Create new job
      const result = await base44.entities.Job.create({ ...payload, owner_user_id: user.id });
      
      // Link orders
      for (const orderId of data.order_ids) {
        await base44.entities.Order.update(orderId, { 
          job_id: result.id,
          status: "in_production"
        });
      }
      
      // If job is created as completed, handle inventory
      if (data.status === "completed" && data.material_cost > 0 && data.product_id) {
        try {
          const product = products.find(p => p.id === data.product_id);
          if (product && product.default_material_id) {
            const { data: inventoryItems } = await queryClient.fetchQuery({
              queryKey: ["inventory-items"],
              queryFn: () => base44.entities.InventoryItem.list(),
            });
            
            const materialType = await base44.entities.MaterialType.get(product.default_material_id);
            const inventoryItem = inventoryItems.find(i => i.material_name === materialType?.name);
            
            if (inventoryItem) {
              await base44.entities.InventoryTransaction.create({
                owner_user_id: user.id,
                inventory_item_id: inventoryItem.id,
                transaction_date: new Date().toISOString().split("T")[0],
                transaction_type: "usage",
                quantity_change: -(data.quantity || 1),
                unit_cost: inventoryItem.average_cost || 0,
                reference_id: result.id,
                notes: `Used for Job ${data.job_number}`,
              });
              
              const newQuantity = Math.max(0, (inventoryItem.quantity_on_hand || 0) - (data.quantity || 1));
              await base44.entities.InventoryItem.update(inventoryItem.id, {
                quantity_on_hand: newQuantity,
                total_value: newQuantity * inventoryItem.average_cost,
                last_updated: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          console.error("Failed to update inventory:", error);
        }
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const addOperation = () => {
    setFormData(prev => ({
      ...prev,
      operations: [...prev.operations, { type: "cut", machine_id: "", duration_minutes: 0 }]
    }));
  };

  const updateOperation = (index, field, value) => {
    const newOps = [...formData.operations];
    newOps[index] = { ...newOps[index], [field]: value };
    setFormData(prev => ({ ...prev, operations: newOps }));
  };

  const removeOperation = (index) => {
    setFormData(prev => ({
      ...prev,
      operations: prev.operations.filter((_, i) => i !== index)
    }));
  };

  const toggleOrder = (orderId) => {
    setFormData(prev => ({
      ...prev,
      order_ids: prev.order_ids.includes(orderId)
        ? prev.order_ids.filter(id => id !== orderId)
        : [...prev.order_ids, orderId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "Edit Job" : "Create Job"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Job Number *</Label>
              <Input
                value={formData.job_number}
                onChange={(e) => setFormData({ ...formData, job_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={formData.product_id}
                onValueChange={(v) => setFormData({ ...formData, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          {/* Link Orders */}
          <div className="space-y-3">
            <Label>Link Orders (Optional)</Label>
            <Input
              placeholder="Search orders by ID, product, or SKU..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="mb-2"
            />
            {availableOrders.length > 0 ? (
              <div className="border rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                {availableOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`order-${order.id}`}
                      checked={formData.order_ids.includes(order.id)}
                      onCheckedChange={() => toggleOrder(order.id)}
                    />
                    <label htmlFor={`order-${order.id}`} className="text-sm cursor-pointer flex-1">
                      <span className="font-medium">{order.order_id}</span>
                      <span className="text-stone-500 ml-2">{order.product_name || order.sku}</span>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-500 text-center py-4">
                {orderSearch ? "No orders match your search" : "No available orders"}
              </p>
            )}
          </div>

          {/* Operations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Operations</Label>
              <Button type="button" variant="outline" size="sm" onClick={addOperation}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            
            {formData.operations.length > 0 && (
              <div className="space-y-3">
                {formData.operations.map((op, index) => (
                  <div key={index} className="flex gap-3 items-end p-3 bg-stone-50 rounded-lg">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={op.type}
                        onValueChange={(v) => updateOperation(index, "type", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cut">Cut</SelectItem>
                          <SelectItem value="engrave">Engrave</SelectItem>
                          <SelectItem value="score">Score</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Machine</Label>
                      <Select
                        value={op.machine_id}
                        onValueChange={(v) => updateOperation(index, "machine_id", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Minutes</Label>
                      <Input
                        type="number"
                        min="0"
                        value={op.duration_minutes}
                        onChange={(e) => updateOperation(index, "duration_minutes", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOperation(index)}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Costs */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-stone-900 mb-4">Cost Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Material Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.material_cost}
                  onChange={(e) => setFormData({ ...formData, material_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Machine Time</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.machine_time_cost}
                  readOnly
                  className="bg-stone-50"
                />
              </div>
              <div className="space-y-2">
                <Label>Electricity</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.electricity_cost}
                  readOnly
                  className="bg-stone-50"
                />
              </div>
              <div className="space-y-2">
                <Label>Overhead</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.overhead_cost}
                  onChange={(e) => setFormData({ ...formData, overhead_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Depreciation</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.depreciation_cost}
                  onChange={(e) => setFormData({ ...formData, depreciation_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Cost</Label>
                <div className="h-10 px-3 flex items-center bg-emerald-50 border border-emerald-200 rounded-md font-semibold text-emerald-700">
                  ${totalCost.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {job ? "Save Changes" : "Create Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}