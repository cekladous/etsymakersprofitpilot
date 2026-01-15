import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Plus, Trash2, User, Package, Clock, ChevronDown, ChevronUp, Calculator, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { calculateProfit, formatCurrency } from "@/components/shared/profitCalculator";
import { Switch } from "@/components/ui/switch";
import ConvertQuoteDialog from "./ConvertQuoteDialog";
import AIPriceSuggester from "./AIPriceSuggester";
import AILaborEstimator from "./AILaborEstimator";

const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
];

const generateQuoteNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${year}${month}${random}`;
};

export default function QuoteFormDialog({ open, onOpenChange, quote }) {
  const [currency, setCurrency] = useState("USD");
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", email: "", phone: "", company: "" });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  const [formData, setFormData] = useState({
    quote_number: generateQuoteNumber(),
    project_name: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_state: "",
    due_date: "",
    status: "Draft",
    notes: "",
    materials: [],
    design_hours: 0,
    design_minutes: 0,
    design_rate_type: "Custom",
    design_rate: 0,
    manual_labor_hours: 0,
    manual_labor_minutes: 0,
    manual_labor_type: "Standard Labor",
    manual_labor_rate: 95,
    machines: [],
    shipping_cost: 0,
    payment_method: "etsy",
    advertising_type: "none",
    advertising_value: 0,
    share_save_enabled: false,
    share_save_discount: 10,
    share_save_discount_type: "percent",
    share_save_fee_rate: 4,
  });

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes"],
    queryFn: () => base44.entities.MaterialType.list(),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });

  const feeConfig = settings[0] || {};

  const [showCalculator, setShowCalculator] = useState(false);
  const [shareSaveExpanded, setShareSaveExpanded] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [desiredMargin, setDesiredMargin] = useState(40);
  const [showAIPricer, setShowAIPricer] = useState(false);

  useEffect(() => {
    if (quote) {
      setFormData({
        ...quote,
        materials: quote.materials || [],
        design_hours: quote.design_hours || 0,
        design_minutes: quote.design_minutes || 0,
        design_rate_type: quote.design_rate_type || "Custom",
        design_rate: quote.design_rate || 0,
        manual_labor_hours: quote.manual_labor_hours || 0,
        manual_labor_minutes: quote.manual_labor_minutes || 0,
        manual_labor_type: quote.manual_labor_type || "Standard Labor",
        manual_labor_rate: quote.manual_labor_rate || 95,
        machines: quote.machines || [],
        shipping_cost: quote.shipping_cost || 0,
        payment_method: quote.payment_method || "etsy",
        advertising_type: quote.advertising_type || "none",
        advertising_value: quote.advertising_value || 0,
        share_save_enabled: quote.share_save_enabled || false,
        share_save_discount: quote.share_save_discount || 10,
        share_save_discount_type: quote.share_save_discount_type || "percent",
        share_save_fee_rate: quote.share_save_fee_rate || 4,
      });
    } else {
      setFormData({
        quote_number: generateQuoteNumber(),
        project_name: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        customer_state: "",
        due_date: "",
        status: "Draft",
        notes: "",
        materials: [],
        design_hours: 0,
        design_minutes: 0,
        design_rate_type: "Custom",
        design_rate: 0,
        manual_labor_hours: 0,
        manual_labor_minutes: 0,
        manual_labor_type: "Standard Labor",
        manual_labor_rate: 95,
        machines: [],
        shipping_cost: 0,
        payment_method: "etsy",
        advertising_type: "none",
        advertising_value: 0,
        share_save_enabled: false,
        share_save_discount: 10,
        share_save_discount_type: "percent",
        share_save_fee_rate: 4,
      });
    }
  }, [quote, open]);

  // Material functions
  const addMaterial = () => {
    setFormData({
      ...formData,
      materials: [...formData.materials, { type: "Custom (Manual)", name: "", cost: 0 }],
    });
  };

  const updateMaterial = (index, field, value) => {
    const newMaterials = [...formData.materials];
    newMaterials[index][field] = value;

    // Auto-populate machine based on material
    if (field === "type" || field === "name") {
      const materialName = (value || newMaterials[index].name || "").toLowerCase();
      let suggestedMachine = null;

      if (materialName.includes("acrylic") || materialName.includes("wood") || materialName.includes("leather")) {
        suggestedMachine = machines.find(m => m.name && m.name.toLowerCase().includes("laser"));
      } else if (materialName.includes("metal")) {
        suggestedMachine = machines.find(m => m.name && m.name.toLowerCase().includes("cnc"));
      }

      if (suggestedMachine && formData.machines.length === 0) {
        setFormData({ 
          ...formData, 
          materials: newMaterials,
          machines: [{ machine_id: suggestedMachine.id, name: suggestedMachine.name, hours: 0, minutes: 0, rate: suggestedMachine.hourly_rate || 50 }]
        });
        return;
      }
    }

    setFormData({ ...formData, materials: newMaterials });
  };

  const removeMaterial = (index) => {
    setFormData({
      ...formData,
      materials: formData.materials.filter((_, i) => i !== index),
    });
  };

  const getMaterialsTotal = () => {
    return formData.materials.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0);
  };

  // Machine functions
  const addMachine = () => {
    setFormData({
      ...formData,
      machines: [...formData.machines, { machine_id: "", name: "", hours: 0, minutes: 0, rate: 0 }],
    });
  };

  const updateMachine = (index, field, value) => {
    const newMachines = [...formData.machines];
    newMachines[index][field] = value;
    
    if (field === "machine_id") {
      const machine = machines.find(m => m.id === value);
      if (machine) {
        newMachines[index].name = machine.name;
        newMachines[index].rate = machine.hourly_rate || 50;
      }
    }
    
    setFormData({ ...formData, machines: newMachines });
  };

  const removeMachine = (index) => {
    setFormData({
      ...formData,
      machines: formData.machines.filter((_, i) => i !== index),
    });
  };

  const getMachineTotal = (machine) => {
    const totalHours = (parseFloat(machine.hours) || 0) + (parseFloat(machine.minutes) || 0) / 60;
    return totalHours * (parseFloat(machine.rate) || 0);
  };

  const getMachinesTotal = () => {
    return formData.machines.reduce((sum, m) => sum + getMachineTotal(m), 0);
  };

  const getDesignServicesTotal = () => {
    const totalHours = (parseFloat(formData.design_hours) || 0) + (parseFloat(formData.design_minutes) || 0) / 60;
    return totalHours * (parseFloat(formData.design_rate) || 0);
  };

  const getManualLaborTotal = () => {
    const totalHours = (parseFloat(formData.manual_labor_hours) || 0) + (parseFloat(formData.manual_labor_minutes) || 0) / 60;
    return totalHours * (parseFloat(formData.manual_labor_rate) || 0);
  };

  const getGrandTotal = () => {
    return getMaterialsTotal() + getDesignServicesTotal() + getManualLaborTotal() + getMachinesTotal();
  };

  const calculateGrandTotal = () => {
    return getMaterialsTotal() + getDesignServicesTotal() + getManualLaborTotal() + getMachinesTotal();
  };

  // Calculate profit
  const profitInputs = {
    sales_price: getGrandTotal(),
    shipping_charged: 0,
    discounts: 0,
    refunds: 0,
    sales_tax: 0,
    cost_of_goods: getMaterialsTotal() + (parseFloat(formData.shipping_cost) || 0),
    shipping_cost: parseFloat(formData.shipping_cost) || 0,
    advertising_type: formData.advertising_type || "none",
    advertising_value: parseFloat(formData.advertising_value) || 0,
    advertising_value_type: "percent",
    payment_method: formData.payment_method || "etsy",
    share_save_enabled: formData.share_save_enabled || false,
    share_save_discount: parseFloat(formData.share_save_discount) || 10,
    share_save_discount_type: formData.share_save_discount_type || "percent",
    share_save_fee_rate: parseFloat(formData.share_save_fee_rate) || 4,
  };

  const profitResults = calculateProfit(profitInputs, feeConfig);
  const laborRevenue = getDesignServicesTotal() + getManualLaborTotal() + getMachinesTotal();

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
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onOpenChange(false);
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const grandTotal = calculateGrandTotal();
      const order = await base44.entities.Order.create({
        channel: "custom",
        order_id: `QUOTE-${formData.quote_number}`,
        sale_date: new Date().toISOString().split("T")[0],
        product_name: formData.project_name,
        gross_total: grandTotal,
        shipping_charged: 0,
        discounts: 0,
        refunds: 0,
        sales_tax: 0,
        net_payout: grandTotal,
        status: "pending",
        notes: `Converted from Quote #${formData.quote_number}\nCustomer: ${formData.customer_name}\nEmail: ${formData.customer_email}`,
      });

      await base44.entities.Quote.update(quote.id, {
        ...formData,
        status: "Accepted",
        converted_to_order_id: order.id,
      });

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowConvertDialog(false);
      onOpenChange(false);
    },
  });

  const handleStatusChange = (newStatus) => {
    if (newStatus === "Accepted" && quote && !quote.converted_to_order_id) {
      setShowConvertDialog(true);
      setPendingStatusChange(newStatus);
    } else {
      setFormData({ ...formData, status: newStatus });
    }
  };

  const handleConfirmConversion = () => {
    convertMutation.mutate();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || "$";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create Quote</DialogTitle>
        </DialogHeader>



        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer & Project */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-stone-600" />
                <CardTitle className="text-base">Customer & Project</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(curr => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.code} ({curr.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-stone-600">Project Name *</Label>
                <Input
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g. Custom Acrylic Sign"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-stone-600">Deadline</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-stone-600">Select Customer (Optional)</Label>
                <Select
                  value={formData.customer_id || ""}
                  onValueChange={(value) => {
                    if (value) {
                      const customer = customers.find(c => c.id === value);
                      if (customer) {
                        setFormData({
                          ...formData,
                          customer_id: customer.id,
                          customer_name: customer.name,
                          customer_email: customer.email || "",
                          customer_phone: customer.phone || "",
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select existing customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers && customers.length > 0 && customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id || ""}>
                        {customer.name} {customer.company ? `(${customer.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="w-full mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {showQuickAdd ? "Cancel" : "Create New Customer"}
                </Button>

                {showQuickAdd && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                    <Input
                      placeholder="Customer name *"
                      value={newCustomerData.name}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={newCustomerData.email}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Phone"
                      value={newCustomerData.phone}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Company (optional)"
                      value={newCustomerData.company}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, company: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newCustomerData.name || isCreatingCustomer}
                      onClick={async () => {
                        setIsCreatingCustomer(true);
                        const customer = await base44.entities.Customer.create(newCustomerData);
                        queryClient.invalidateQueries({ queryKey: ["customers"] });
                        setFormData({
                          ...formData,
                          customer_id: customer.id,
                          customer_name: customer.name,
                          customer_email: customer.email || "",
                          customer_phone: customer.phone || "",
                        });
                        setNewCustomerData({ name: "", email: "", phone: "", company: "" });
                        setShowQuickAdd(false);
                        setIsCreatingCustomer(false);
                      }}
                      className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isCreatingCustomer ? "Adding..." : "Add Customer"}
                    </Button>
                  </div>
                )}
                </div>

              <Collapsible open={customerDetailsOpen} onOpenChange={setCustomerDetailsOpen}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors">
                    <span className="text-sm text-stone-600">
                      {customerDetailsOpen ? "− Hide" : "+"} Customer Details
                    </span>
                    {customerDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-3">
                  <div>
                    <Label className="text-xs text-stone-600">Name</Label>
                    <Input
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      className="mt-1"
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
                  <div>
                    <Label className="text-xs text-stone-600">Phone</Label>
                    <Input
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div>
                <Label className="text-xs text-stone-600">Status</Label>
                <Select value={formData.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Accepted">Accepted</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                {quote?.converted_to_order_id && (
                  <p className="text-xs text-emerald-600 mt-1">✓ Converted to Order</p>
                )}
              </div>

              <div>
                <Label className="text-xs text-stone-600">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional details..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              </CardContent>
              </Card>

          {/* Materials Cost */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-stone-600" />
                  <CardTitle className="text-base">Materials Cost</CardTitle>
                </div>
                <div className="text-sm text-stone-600">
                  Total: <span className="font-semibold">{currencySymbol}{getMaterialsTotal().toFixed(2)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-stone-500 font-medium">Materials</div>
              
              {formData.materials.map((material, index) => (
                <div key={index} className="space-y-2 p-3 bg-stone-50 rounded-lg relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMaterial(index)}
                    className="absolute top-2 right-2 h-6 w-6 text-stone-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  
                  <div>
                    <Label className="text-xs text-stone-600">Material</Label>
                    <Select
                      value={material.type}
                      onValueChange={(value) => updateMaterial(index, "type", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Custom (Manual)">Custom (Manual)</SelectItem>
                        {materialTypes.map(mt => (
                          <SelectItem key={mt.id} value={mt.name}>
                            {mt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-stone-600">Material Name</Label>
                    <Input
                      value={material.name}
                      onChange={(e) => updateMaterial(index, "name", e.target.value)}
                      placeholder="Material Name"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-stone-600">Cost ({currencySymbol})</Label>
                    <Input
                      type="number"
                      value={material.cost}
                      onChange={(e) => updateMaterial(index, "cost", e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addMaterial}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Material
              </Button>
            </CardContent>
          </Card>

          {/* Labor & Machine Time */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-stone-600" />
                <CardTitle className="text-base">Labor & Machine Time</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <AILaborEstimator
                projectName={formData.project_name}
                materials={formData.materials}
                machines={formData.machines}
                onEstimate={(estimates) => {
                  setFormData({
                    ...formData,
                    design_hours: estimates.design_hours,
                    design_minutes: estimates.design_minutes,
                    manual_labor_hours: estimates.labor_hours,
                    manual_labor_minutes: estimates.labor_minutes,
                    machines: formData.machines.map((m, i) => 
                      i === 0 ? { ...m, hours: estimates.machine_hours, minutes: estimates.machine_minutes } : m
                    )
                  });
                }}
              />
              {/* Design Services */}
              <div>
                <div className="text-xs text-stone-500 font-medium mb-3">Design Services</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Input
                      type="number"
                      value={formData.design_hours}
                      onChange={(e) => setFormData({ ...formData, design_hours: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                    <div className="text-xs text-stone-400 mt-1 text-center">hr</div>
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={formData.design_minutes}
                      onChange={(e) => setFormData({ ...formData, design_minutes: e.target.value })}
                      placeholder="0"
                      min="0"
                      max="59"
                    />
                    <div className="text-xs text-stone-400 mt-1 text-center">min</div>
                  </div>
                  <div>
                    <Select value={formData.design_rate_type} onValueChange={(value) => setFormData({ ...formData, design_rate_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Custom">Custom</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-stone-400 mt-1 text-center">{currencySymbol}/hr</div>
                  </div>
                </div>
                <div className="mt-2">
                  <Input
                    type="number"
                    value={formData.design_rate}
                    onChange={(e) => setFormData({ ...formData, design_rate: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  <div className="text-xs text-stone-400 mt-1">Rate: {currencySymbol}{formData.design_rate}/hr</div>
                </div>
              </div>

              {/* Manual Labor */}
              <div>
                <div className="text-xs text-stone-500 font-medium mb-3">Manual Labor</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Input
                      type="number"
                      value={formData.manual_labor_hours}
                      onChange={(e) => setFormData({ ...formData, manual_labor_hours: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                    <div className="text-xs text-stone-400 mt-1 text-center">hr</div>
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={formData.manual_labor_minutes}
                      onChange={(e) => setFormData({ ...formData, manual_labor_minutes: e.target.value })}
                      placeholder="0"
                      min="0"
                      max="59"
                    />
                    <div className="text-xs text-stone-400 mt-1 text-center">min</div>
                  </div>
                  <div>
                    <Select value={formData.manual_labor_type} onValueChange={(value) => setFormData({ ...formData, manual_labor_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Standard Labor">Standard Labor</SelectItem>
                        <SelectItem value="Skilled Labor">Skilled Labor</SelectItem>
                        <SelectItem value="Custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-xs text-stone-500 mt-2">{currencySymbol}{formData.manual_labor_rate.toFixed(2)}/hr</div>
              </div>

              {/* Machines Used */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-stone-500 font-medium">Machines Used</div>
                  <div className="text-sm text-stone-600">
                    Total: <span className="font-semibold">{currencySymbol}{getMachinesTotal().toFixed(2)}</span>
                  </div>
                </div>

                {formData.machines.map((machine, index) => (
                  <div key={index} className="space-y-2 p-3 bg-stone-50 rounded-lg mb-3 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMachine(index)}
                      className="absolute top-2 right-2 h-6 w-6 text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>

                    <div>
                      <Label className="text-xs text-stone-600">Machine</Label>
                      <Select
                        value={machine.machine_id}
                        onValueChange={(value) => updateMachine(index, "machine_id", value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select machine..." />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {machine.name && (
                      <div className="text-sm text-stone-600 font-medium">{machine.name}</div>
                    )}

                    <div>
                      <Label className="text-xs text-stone-600">Time</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <Input
                            type="number"
                            value={machine.hours}
                            onChange={(e) => updateMachine(index, "hours", e.target.value)}
                            placeholder="0"
                            min="0"
                          />
                          <div className="text-xs text-stone-400 mt-1 text-center">hr</div>
                        </div>
                        <div>
                          <Input
                            type="number"
                            value={machine.minutes}
                            onChange={(e) => updateMachine(index, "minutes", e.target.value)}
                            placeholder="0"
                            min="0"
                            max="59"
                          />
                          <div className="text-xs text-stone-400 mt-1 text-center">min</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-stone-600">Rate ({currencySymbol}/hr)</Label>
                      <Input
                        type="number"
                        value={machine.rate}
                        onChange={(e) => updateMachine(index, "rate", e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="mt-1"
                      />
                    </div>

                    <div className="text-right text-base font-semibold pt-2 border-t">
                      {currencySymbol}{getMachineTotal(machine).toFixed(2)}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addMachine}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Machine
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Price Suggester */}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAIPricer(!showAIPricer)}
              className="w-full mb-4"
            >
              {showAIPricer ? "Hide" : "Show"} AI Price Suggester
            </Button>
            {showAIPricer && (
              <AIPriceSuggester
                materialsTotal={getMaterialsTotal()}
                laborTotal={getDesignServicesTotal() + getManualLaborTotal()}
                machineTotal={getMachinesTotal()}
                desiredMargin={desiredMargin}
                onSuggestedPrice={(price) => {
                  // Update the form to reflect the suggested price
                  // We'll adjust the manual labor rate to achieve this price
                  const currentCost = getMaterialsTotal() + getMachinesTotal();
                  const designHours = (parseFloat(formData.design_hours) || 0) + (parseFloat(formData.design_minutes) || 0) / 60;
                  const laborHours = (parseFloat(formData.manual_labor_hours) || 0) + (parseFloat(formData.manual_labor_minutes) || 0) / 60;
                  const totalServiceHours = designHours + laborHours;

                  if (totalServiceHours > 0) {
                    const suggestedServiceRate = (price - currentCost) / totalServiceHours;
                    setFormData({
                      ...formData,
                      manual_labor_rate: suggestedServiceRate
                    });
                  } else {
                    // If no service hours, add as a manual material cost
                    const newMaterials = [...formData.materials];
                    newMaterials.push({
                      type: "Custom (Manual)",
                      name: "AI Suggested Price Adjustment",
                      cost: price - currentCost
                    });
                    setFormData({
                      ...formData,
                      materials: newMaterials
                    });
                  }
                  setShowAIPricer(false);
                }}
              />
            )}
          </div>

          {/* Grand Total */}
          <div className="bg-stone-800 text-white p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Grand Total</span>
              <span className="text-2xl font-bold">{currencySymbol}{getGrandTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1 bg-stone-800 hover:bg-stone-900">
              {saveMutation.isPending ? "Saving..." : quote ? "Update Quote" : "Save as Quote Draft"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <ConvertQuoteDialog
      open={showConvertDialog}
      onOpenChange={setShowConvertDialog}
      quote={quote}
      onConfirm={handleConfirmConversion}
      isPending={convertMutation.isPending}
    />
    </>
  );
}