import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Plus, Trash2, User, Package, Clock, ChevronDown, ChevronUp, Calculator, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { calculateProfit, formatCurrency } from "@/components/shared/profitCalculator";
import { Switch } from "@/components/ui/switch";
import ConvertQuoteDialog from "./ConvertQuoteDialog";
import AIPriceSuggester from "./AIPriceSuggester";
import AILaborEstimator from "./AILaborEstimator";
import CostBreakdownPanel from "./CostBreakdownPanel";
import CustomerSearchSelect from "@/components/customers/CustomerSearchSelect";

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
  const { user } = useAuth();
  const [currency, setCurrency] = useState("USD");
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", email: "", phone: "", company: "" });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  const [formData, setFormData] = useState({
    quote_number: generateQuoteNumber(),
    product_template_id: "",
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
    overhead_per_item: 0,
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
        labor_hours: quote.labor_hours || 0,
        labor_minutes: quote.labor_minutes || 0,
        labor_rate: quote.labor_rate || 50,
        machines: quote.machines || [],
        shipping_cost: quote.shipping_cost || 0,
        overhead_per_item: quote.overhead_per_item || 0,
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
        product_template_id: "",
        project_name: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        customer_state: "",
        due_date: "",
        status: "Draft",
        notes: "",
        materials: [],
        labor_hours: 0,
        labor_minutes: 0,
        labor_rate: 50,
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

    // Auto-populate machine based on material (default to xTool P3)
      if (field === "type" || field === "name") {
        const materialName = (value || newMaterials[index].name || "").toLowerCase();

        // Default to xTool P3 for laser-compatible materials
         if (materialName.includes("acrylic") || materialName.includes("wood") || materialName.includes("leather")) {
           const defaultMachine = machines.find(m => m.name && m.name.toLowerCase().includes("xtool p3")) || 
                                machines.find(m => m.name && m.name.toLowerCase().includes("laser"));

           if (defaultMachine && formData.machines.length === 0) {
             const hourlyDepreciation = Math.round(((defaultMachine.monthly_depreciation || 0) / 160) * 100) / 100;
             setFormData({ 
               ...formData, 
               materials: newMaterials,
               machines: [{ machine_id: defaultMachine.id, name: defaultMachine.name, hours: 0, minutes: 0, rate: hourlyDepreciation || 0 }]
             });
             return;
           }
         } else if (materialName.includes("metal")) {
           const cncMachine = machines.find(m => m.name && m.name.toLowerCase().includes("cnc"));
           if (cncMachine && formData.machines.length === 0) {
             const hourlyDepreciation = Math.round(((cncMachine.monthly_depreciation || 0) / 160) * 100) / 100;
             setFormData({ 
               ...formData, 
               materials: newMaterials,
               machines: [{ machine_id: cncMachine.id, name: cncMachine.name, hours: 0, minutes: 0, rate: hourlyDepreciation || 0 }]
             });
             return;
           }
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
        // Convert monthly depreciation to hourly rate (assuming 160 business hours/month), rounded to 2 decimals
        const hourlyDepreciation = Math.round(((machine.monthly_depreciation || 0) / 160) * 100) / 100;
        newMachines[index].rate = hourlyDepreciation || 0;
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

  const getLaborTotal = () => {
    const totalHours = (parseFloat(formData.labor_hours) || 0) + (parseFloat(formData.labor_minutes) || 0) / 60;
    return totalHours * (parseFloat(formData.labor_rate) || 0);
  };

  const getGrandTotal = () => {
    return getMaterialsTotal() + getLaborTotal() + getMachinesTotal();
  };

  const handleProductTemplateSelect = (productId) => {
    if (!productId) {
      setFormData({ ...formData, product_template_id: "" });
      return;
    }
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newMaterials = [];

    // Pre-fill default material with cost derived from area and sheet cost
    if (product.default_material_id) {
      const materialType = materialTypes.find(mt => mt.id === product.default_material_id);
      if (materialType) {
        let cost = 0;
        if (product.area_per_unit && materialType.default_width && materialType.default_height && materialType.cost_per_sheet) {
          const sheetArea = materialType.default_width * materialType.default_height;
          const costPerSqInch = materialType.cost_per_sheet / sheetArea;
          cost = Math.round((product.area_per_unit * costPerSqInch) * 100) / 100;
        }
        newMaterials.push({ type: materialType.name, name: materialType.name, cost });
      }
    }

    // Add packaging cost as a material line
    if (product.packaging_cost && product.packaging_cost > 0) {
      newMaterials.push({ type: "Custom (Manual)", name: "Packaging", cost: product.packaging_cost });
    }

    // Pre-fill machine time from laser_minutes_per_unit
    let newMachines = [...formData.machines];
    if (product.laser_minutes_per_unit && product.laser_minutes_per_unit > 0) {
      const defaultMachine = machines.find(m => m.name && m.name.toLowerCase().includes("xtool p3")) ||
                             machines.find(m => m.name && m.name.toLowerCase().includes("laser"));
      if (defaultMachine) {
        const hourlyDepreciation = Math.round(((defaultMachine.monthly_depreciation || 0) / 160) * 100) / 100;
        if (newMachines.length > 0) {
          newMachines[0] = { ...newMachines[0], machine_id: defaultMachine.id, name: defaultMachine.name, minutes: product.laser_minutes_per_unit, rate: hourlyDepreciation || 0 };
        } else {
          newMachines.push({ machine_id: defaultMachine.id, name: defaultMachine.name, hours: 0, minutes: product.laser_minutes_per_unit, rate: hourlyDepreciation || 0 });
        }
      }
    }

    setFormData({
      ...formData,
      product_template_id: product.id,
      project_name: formData.project_name || product.name,
      materials: newMaterials.length > 0 ? newMaterials : formData.materials,
      machines: newMachines,
    });
  };

  const calculateGrandTotal = () => {
    return getMaterialsTotal() + getLaborTotal() + getMachinesTotal();
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
  const laborRevenue = getLaborTotal() + getMachinesTotal();

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (quote) {
        return base44.entities.Quote.update(quote.id, data);
      } else {
        return base44.entities.Quote.create({ ...data, owner_user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onOpenChange(false);
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (channel = "custom") => {
      const grandTotal = calculateGrandTotal();
      const order = await base44.entities.Order.create({
        owner_user_id: user.id,
        channel: channel,
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

  const handleConfirmConversion = (channel) => {
    convertMutation.mutate(channel);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, total: getGrandTotal() });
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
                <Label className="text-xs text-stone-600">Product Template (Optional)</Label>
                <Select
                  value={formData.product_template_id || ""}
                  onValueChange={handleProductTemplateSelect}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a product to pre-fill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products && products.length > 0 && products
                      .filter(p => p.active !== false)
                      .map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} {product.sku ? `(${product.sku})` : ""}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-stone-400 mt-1">
                  Pre-fills title, materials, and machine time from your saved product.
                </p>
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
                <div className="mt-1">
                  <CustomerSearchSelect
                    value={formData.customer_id}
                    onCustomerSelect={(customer) => {
                      setFormData({
                        ...formData,
                        customer_id: customer.id,
                        customer_name: customer.name,
                        customer_email: customer.email || "",
                        customer_phone: customer.phone || "",
                      });
                    }}
                  />
                </div>
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
                    <SelectItem value="Invoiced">Invoiced</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Declined">Declined</SelectItem>
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
                    labor_hours: estimates.design_hours + estimates.labor_hours,
                    labor_minutes: estimates.design_minutes + estimates.labor_minutes,
                    machines: formData.machines.map((m, i) => 
                      i === 0 ? { ...m, hours: estimates.machine_hours, minutes: estimates.machine_minutes } : m
                    )
                  });
                }}
              />
              {/* Design & Labor Service */}
              <div>
                <div className="text-xs text-stone-500 font-medium mb-3">Design & Labor Service</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      type="number"
                      value={formData.labor_hours}
                      onChange={(e) => setFormData({ ...formData, labor_hours: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                    <div className="text-xs text-stone-400 mt-1 text-center">hr</div>
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={formData.labor_minutes}
                      onChange={(e) => setFormData({ ...formData, labor_minutes: e.target.value })}
                      placeholder="0"
                      min="0"
                      max="59"
                    />
                    <div className="text-xs text-stone-400 mt-1 text-center">min</div>
                  </div>
                </div>
                <div className="mt-2">
                  <Input
                    type="number"
                    value={formData.labor_rate}
                    onChange={(e) => setFormData({ ...formData, labor_rate: e.target.value })}
                    placeholder="50.00"
                    step="0.01"
                    min="0"
                  />
                  <div className="text-xs text-stone-400 mt-1">Rate: {currencySymbol}{formData.labor_rate}/hr</div>
                </div>
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
          <AIPriceSuggester
            materialsTotal={getMaterialsTotal()}
            projectName={formData.project_name}
            materials={formData.materials}
            onSuggestedPrice={(price) => {
              // Calculate the rate to achieve the suggested price
              const costBasis = getMaterialsTotal();
              const profitNeeded = price - costBasis;

              const laborHours = (parseFloat(formData.labor_hours) || 0) + (parseFloat(formData.labor_minutes) || 0) / 60;
              const machineHours = formData.machines.reduce((sum, m) => sum + (parseFloat(m.hours) || 0) + (parseFloat(m.minutes) || 0) / 60, 0);
              const totalHours = laborHours + machineHours;

              if (totalHours > 0) {
                const hourlyRate = profitNeeded / totalHours;
                setFormData({
                  ...formData,
                  labor_rate: hourlyRate,
                  machines: formData.machines.map(m => ({ ...m, rate: hourlyRate }))
                });
              }
            }}
          />

          {/* Cost Breakdown Panel */}
          <CostBreakdownPanel
            materialsTotal={getMaterialsTotal()}
            laborTotal={getLaborTotal()}
            machineTotal={getMachinesTotal()}
            overheadPerItem={formData.overhead_per_item}
            onOverheadChange={(value) => setFormData({ ...formData, overhead_per_item: value })}
            desiredMargin={desiredMargin}
            onMarginChange={setDesiredMargin}
            currencySymbol={currencySymbol}
          />

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