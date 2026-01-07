import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Trash2, Save, Loader2, Zap, Settings as SettingsIcon, CircleDollarSign, History, ExternalLink, Megaphone } from "lucide-react";
import { format } from "date-fns";

const EXPENSE_CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "shipping", label: "Shipping" },
  { value: "tools", label: "Tools" },
  { value: "software", label: "Software" },
  { value: "advertising", label: "Advertising" },
  { value: "utilities", label: "Utilities" },
  { value: "etsy_fees", label: "Etsy Fees" },
  { value: "packaging", label: "Packaging" },
  { value: "equipment", label: "Equipment" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

export default function SettingsTool() {
  const [machineFormOpen, setMachineFormOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feeChangeLogOpen, setFeeChangeLogOpen] = useState(false);
  
  const [settingsData, setSettingsData] = useState({
    electricity_rate: 0.12,
    monthly_overhead: 0,
    default_markup: 0,
    business_name: "",
    etsy_listing_fee: 0.20,
    etsy_transaction_fee_percent: 6.5,
    payment_processing_fee_percent: 3.0,
    payment_processing_fee_fixed: 0.25,
    paypal_fee_percent: 3.49,
    paypal_fee_fixed: 0.49,
    square_fee_percent: 2.9,
    square_fee_fixed: 0.30,
    venmo_business_fee_percent: 1.9,
    venmo_business_fee_fixed: 0.10,
    fee_country: "US",
    fee_source_url: "https://help.etsy.com/hc/en-us/articles/360035902374",
    fees_last_verified_date: "",
    auto_categorization_rules: [],
    advertising_sources: {
      etsy_ads: { source_url: "https://help.etsy.com/hc/en-us/articles/360000338367", notes: "" },
      etsy_offsite_ads: { source_url: "https://help.etsy.com/hc/en-us/articles/360000337607", notes: "" },
      social_ads: { source_url: "", notes: "Rates vary by platform (Meta, TikTok, etc.)" },
      google_ads: { source_url: "https://support.google.com/google-ads/answer/6275294", notes: "" },
      influencer_affiliate: { source_url: "", notes: "No fixed platform fees" },
    },
  });

  const [machineData, setMachineData] = useState({
    name: "",
    brand: "",
    model: "",
    type: "laser",
    wattage: "",
    hourly_rate: "",
    purchase_price: "",
    purchase_date: "",
    depreciation_years: 5,
  });

  const machineBrands = [
    { value: "atomstack", label: "Atomstack" },
    { value: "boss", label: "Boss Laser" },
    { value: "creality", label: "Creality" },
    { value: "epilog", label: "Epilog" },
    { value: "fsl", label: "Full Spectrum Laser" },
    { value: "generic", label: "Generic/K40" },
    { value: "glowforge", label: "Glowforge" },
    { value: "laserpecker", label: "LaserPecker" },
    { value: "longer", label: "Longer" },
    { value: "monport", label: "Monport" },
    { value: "omtech", label: "OMTech" },
    { value: "ortur", label: "Ortur" },
    { value: "thunder", label: "Thunder Laser" },
    { value: "trotec", label: "Trotec" },
    { value: "wecreat", label: "WeCreat" },
    { value: "xtool", label: "xTool" },
    { value: "other", label: "Other" },
  ];

  const machineModels = {
    atomstack: ["A5 M50", "A10 Pro", "A20 Pro", "X7 Pro", "S10 Pro", "P7 M40", "Other"],
    boss: ["LS-1416", "LS-1630", "HP-1610", "HP-2440", "LS-2436", "Other"],
    creality: ["Falcon", "Falcon 2", "CV-30", "Other"],
    epilog: ["Zing 16", "Zing 24", "Fusion Pro", "Fusion Edge", "Other"],
    fsl: ["Muse", "H-Series", "Pro Series", "Other"],
    generic: ["K40", "Generic CO2", "Generic Diode", "Other"],
    glowforge: ["Basic", "Plus", "Pro", "Aura", "Other"],
    laserpecker: ["LP3", "LP4", "L1 Pro", "L2", "Other"],
    longer: ["Ray5", "Laser B1", "Other"],
    monport: ["40W", "50W", "60W", "80W", "100W", "Other"],
    omtech: ["40W", "50W", "60W", "80W", "100W", "130W", "Other"],
    ortur: ["LM2", "LM3", "Laser Master 3", "H10", "Other"],
    thunder: ["Nova 24", "Nova 35", "Nova 51", "Odin", "Other"],
    trotec: ["Speedy 100", "Speedy 300", "Speedy 400", "SP500", "Other"],
    wecreat: ["Vision", "Other"],
    xtool: ["D1", "D1 Pro", "M1", "P2", "P3", "S1", "F1", "F1 Ultra", "Other"],
    other: ["Custom"],
  };

  const [newRule, setNewRule] = useState({ keyword: "", category: "other" });

  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
  });

  const { data: feeChangeLogs = [] } = useQuery({
    queryKey: ["fee-change-logs"],
    queryFn: () => base44.entities.FeeChangeLog.list("-created_date", 50),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const s = settings[0];
      setSettingsData({
        electricity_rate: s.electricity_rate || 0.12,
        monthly_overhead: s.monthly_overhead || 0,
        default_markup: s.default_markup || 0,
        business_name: s.business_name || "",
        etsy_listing_fee: s.etsy_listing_fee ?? 0.20,
        etsy_transaction_fee_percent: s.etsy_transaction_fee_percent ?? 6.5,
        payment_processing_fee_percent: s.payment_processing_fee_percent ?? 3.0,
        payment_processing_fee_fixed: s.payment_processing_fee_fixed ?? 0.25,
        paypal_fee_percent: s.paypal_fee_percent ?? 3.49,
        paypal_fee_fixed: s.paypal_fee_fixed ?? 0.49,
        square_fee_percent: s.square_fee_percent ?? 2.9,
        square_fee_fixed: s.square_fee_fixed ?? 0.30,
        venmo_business_fee_percent: s.venmo_business_fee_percent ?? 1.9,
        venmo_business_fee_fixed: s.venmo_business_fee_fixed ?? 0.10,
        fee_country: s.fee_country || "US",
        fee_source_url: s.fee_source_url || "https://help.etsy.com/hc/en-us/articles/360035902374",
        fees_last_verified_date: s.fees_last_verified_date || "",
        auto_categorization_rules: s.auto_categorization_rules || [],
        advertising_sources: s.advertising_sources || {
          etsy_ads: { source_url: "https://help.etsy.com/hc/en-us/articles/360000338367", notes: "" },
          etsy_offsite_ads: { source_url: "https://help.etsy.com/hc/en-us/articles/360000337607", notes: "" },
          social_ads: { source_url: "", notes: "Rates vary by platform (Meta, TikTok, etc.)" },
          google_ads: { source_url: "https://support.google.com/google-ads/answer/6275294", notes: "" },
          influencer_affiliate: { source_url: "", notes: "No fixed platform fees" },
        },
      });
    }
  }, [settings]);

  const settingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings.length > 0) {
        return base44.entities.Settings.update(settings[0].id, data);
      }
      return base44.entities.Settings.create({ ...data, setting_key: "global" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaving(false);
    },
  });

  const machineMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        wattage: parseFloat(data.wattage) || 0,
        hourly_rate: parseFloat(data.hourly_rate) || 0,
        purchase_price: parseFloat(data.purchase_price) || 0,
        depreciation_years: parseInt(data.depreciation_years) || 5,
        monthly_depreciation: data.purchase_price && data.depreciation_years
          ? parseFloat(data.purchase_price) / (parseInt(data.depreciation_years) * 12)
          : 0,
      };
      
      if (editingMachine) {
        return base44.entities.Machine.update(editingMachine.id, payload);
      }
      return base44.entities.Machine.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      setMachineFormOpen(false);
      setEditingMachine(null);
      setMachineData({
        name: "",
        type: "laser",
        wattage: "",
        hourly_rate: "",
        purchase_price: "",
        purchase_date: "",
        depreciation_years: 5,
      });
    },
  });

  const deleteMachineMutation = useMutation({
    mutationFn: (id) => base44.entities.Machine.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });

  const handleSaveSettings = () => {
    setSaving(true);
    settingsMutation.mutate(settingsData);
  };

  const handleMarkFeesVerified = () => {
    const today = new Date().toISOString().split('T')[0];
    setSettingsData(prev => ({ ...prev, fees_last_verified_date: today }));
  };

  const handleAddRule = () => {
    if (newRule.keyword.trim()) {
      setSettingsData(prev => ({
        ...prev,
        auto_categorization_rules: [...prev.auto_categorization_rules, newRule],
      }));
      setNewRule({ keyword: "", category: "other" });
    }
  };

  const handleRemoveRule = (index) => {
    setSettingsData(prev => ({
      ...prev,
      auto_categorization_rules: prev.auto_categorization_rules.filter((_, i) => i !== index),
    }));
  };

  const openMachineForm = (machine = null) => {
    if (machine) {
      setEditingMachine(machine);
      setMachineData({
        name: machine.name || "",
        brand: machine.brand || "",
        model: machine.model || "",
        type: machine.type || "laser",
        wattage: machine.wattage?.toString() || "",
        hourly_rate: machine.hourly_rate?.toString() || "",
        purchase_price: machine.purchase_price?.toString() || "",
        purchase_date: machine.purchase_date || "",
        depreciation_years: machine.depreciation_years || 5,
      });
    } else {
      setEditingMachine(null);
      setMachineData({
        name: "",
        brand: "",
        model: "",
        type: "laser",
        wattage: "",
        hourly_rate: "",
        purchase_price: "",
        purchase_date: "",
        depreciation_years: 5,
      });
    }
    setMachineFormOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Business Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle>Business Configuration</CardTitle>
              <CardDescription>Cost settings, marketplace fees, machines, and automation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Cost Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-stone-900">Cost Settings</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Electricity Rate ($/kWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settingsData.electricity_rate}
                  onChange={(e) => setSettingsData({ ...settingsData, electricity_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Overhead ($)</Label>
                <Input
                  type="number"
                  step="1"
                  value={settingsData.monthly_overhead}
                  onChange={(e) => setSettingsData({ ...settingsData, monthly_overhead: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  value={settingsData.business_name}
                  onChange={(e) => setSettingsData({ ...settingsData, business_name: e.target.value })}
                  placeholder="My Maker Shop"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Marketplace Fees */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-stone-900">Payment Processor Fees</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeeChangeLogOpen(true)}
              >
                <History className="w-4 h-4 mr-2" />
                Fee Change Log
              </Button>
            </div>

            <Tabs defaultValue="etsy" className="w-full">
              <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
                <TabsTrigger value="etsy">Etsy</TabsTrigger>
                <TabsTrigger value="paypal">PayPal</TabsTrigger>
                <TabsTrigger value="square">Square</TabsTrigger>
                <TabsTrigger value="venmo">Venmo</TabsTrigger>
                <TabsTrigger value="free" className="hidden lg:flex">Free</TabsTrigger>
              </TabsList>

              <TabsContent value="etsy" className="space-y-4 mt-4">
                <div className="bg-gradient-to-br from-orange-50 to-white p-4 rounded-lg border border-orange-100">
                  <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                    <span className="text-orange-600">🛍️</span> Etsy Payments
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Listing Fee ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.etsy_listing_fee ?? 0.20}
                        onChange={(e) => setSettingsData({ ...settingsData, etsy_listing_fee: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current rate: $0.20 per listing</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Transaction Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settingsData.etsy_transaction_fee_percent ?? 6.5}
                        onChange={(e) => setSettingsData({ ...settingsData, etsy_transaction_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current rate: 6.5% of price + shipping</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Processing (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settingsData.payment_processing_fee_percent ?? 3.0}
                        onChange={(e) => setSettingsData({ ...settingsData, payment_processing_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current US rate: 3.0%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Processing Fixed ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.payment_processing_fee_fixed ?? 0.25}
                        onChange={(e) => setSettingsData({ ...settingsData, payment_processing_fee_fixed: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current US rate: $0.25 per order</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-orange-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Fee Source</Label>
                      {settingsData.fee_source_url && (
                        <a
                          href={settingsData.fee_source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Official Page
                        </a>
                      )}
                    </div>
                    <Input
                      type="text"
                      placeholder="https://help.etsy.com/..."
                      value={settingsData.fee_source_url}
                      onChange={(e) => setSettingsData({ ...settingsData, fee_source_url: e.target.value })}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Verified</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={settingsData.fees_last_verified_date}
                          onChange={(e) => setSettingsData({ ...settingsData, fees_last_verified_date: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsData({ ...settingsData, fees_last_verified_date: new Date().toISOString().split('T')[0] })}
                        >
                          Today
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="paypal" className="space-y-4 mt-4">
                <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border border-blue-100">
                  <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                    <span className="text-blue-600">💳</span> PayPal
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PayPal Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.paypal_fee_percent ?? 3.49}
                        onChange={(e) => setSettingsData({ ...settingsData, paypal_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current US rate: 3.49%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>PayPal Fixed Fee ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.paypal_fee_fixed ?? 0.49}
                        onChange={(e) => setSettingsData({ ...settingsData, paypal_fee_fixed: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current US rate: $0.49 per transaction</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="square" className="space-y-4 mt-4">
                <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-lg border border-slate-100">
                  <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                    <span className="text-slate-600">▪️</span> Square
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Square Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.square_fee_percent ?? 2.9}
                        onChange={(e) => setSettingsData({ ...settingsData, square_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current online rate: 2.9%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Square Fixed Fee ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.square_fee_fixed ?? 0.30}
                        onChange={(e) => setSettingsData({ ...settingsData, square_fee_fixed: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current online rate: $0.30 per transaction</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="venmo" className="space-y-4 mt-4">
                <div className="bg-gradient-to-br from-sky-50 to-white p-4 rounded-lg border border-sky-100">
                  <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                    <span className="text-sky-600">📱</span> Venmo Business
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Venmo Business Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.venmo_business_fee_percent ?? 1.9}
                        onChange={(e) => setSettingsData({ ...settingsData, venmo_business_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current rate: 1.9%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Venmo Business Fixed Fee ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.venmo_business_fee_fixed ?? 0.10}
                        onChange={(e) => setSettingsData({ ...settingsData, venmo_business_fee_fixed: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current rate: $0.10 per transaction</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500 mt-3 italic">Note: Venmo Personal, Zelle, and Cash have no processing fees</p>
                </div>
              </TabsContent>

              <TabsContent value="free" className="space-y-4 mt-4">
                <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-lg border border-emerald-100 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h4 className="font-semibold text-stone-900 mb-2">No-Fee Payment Methods</h4>
                  <p className="text-stone-600 text-sm mb-4">The following payment methods have zero processing fees:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-3 py-1 bg-white border border-emerald-200 rounded-full text-sm text-stone-700">Venmo Personal</span>
                    <span className="px-3 py-1 bg-white border border-emerald-200 rounded-full text-sm text-stone-700">Zelle</span>
                    <span className="px-3 py-1 bg-white border border-emerald-200 rounded-full text-sm text-stone-700">Cash</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Machines */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-600" />
                <h3 className="font-semibold text-stone-900">Machines</h3>
              </div>
              <Button onClick={() => openMachineForm()} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Machine
              </Button>
            </div>
            {machines.length > 0 ? (
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Power</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead>Monthly Depr.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium">{machine.name}</TableCell>
                    <TableCell className="capitalize">{machine.type}</TableCell>
                    <TableCell>{machine.wattage}W</TableCell>
                    <TableCell>${(machine.hourly_rate || 0).toFixed(2)}/hr</TableCell>
                    <TableCell>${(machine.monthly_depreciation || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMachineForm(machine)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMachineMutation.mutate(machine.id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-stone-400 text-sm">
                No machines configured. Add your first machine to track costs.
              </div>
            )}
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Advertising Sources */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-stone-900">Advertising Platform Sources</h3>
            </div>
            <p className="text-sm text-stone-600">Manage source URLs and notes for each advertising type used in the Profit Calculator.</p>

            <div className="space-y-3">
              {/* Etsy Ads */}
              <div className="p-4 bg-stone-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Etsy Ads</Label>
                  {settingsData.advertising_sources?.etsy_ads?.source_url && (
                    <a
                      href={settingsData.advertising_sources.etsy_ads.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Official Page
                    </a>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="Source URL"
                  value={settingsData.advertising_sources?.etsy_ads?.source_url || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      etsy_ads: { ...settingsData.advertising_sources?.etsy_ads, source_url: e.target.value }
                    }
                  })}
                />
                <Input
                  type="text"
                  placeholder="Notes (optional)"
                  value={settingsData.advertising_sources?.etsy_ads?.notes || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      etsy_ads: { ...settingsData.advertising_sources?.etsy_ads, notes: e.target.value }
                    }
                  })}
                />
              </div>

              {/* Etsy Offsite Ads */}
              <div className="p-4 bg-stone-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Etsy Offsite Ads</Label>
                  {settingsData.advertising_sources?.etsy_offsite_ads?.source_url && (
                    <a
                      href={settingsData.advertising_sources.etsy_offsite_ads.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Official Page
                    </a>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="Source URL"
                  value={settingsData.advertising_sources?.etsy_offsite_ads?.source_url || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      etsy_offsite_ads: { ...settingsData.advertising_sources?.etsy_offsite_ads, source_url: e.target.value }
                    }
                  })}
                />
                <Input
                  type="text"
                  placeholder="Notes (optional)"
                  value={settingsData.advertising_sources?.etsy_offsite_ads?.notes || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      etsy_offsite_ads: { ...settingsData.advertising_sources?.etsy_offsite_ads, notes: e.target.value }
                    }
                  })}
                />
              </div>

              {/* Social Ads */}
              <div className="p-4 bg-stone-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Social Ads (Meta, TikTok, etc.)</Label>
                  {settingsData.advertising_sources?.social_ads?.source_url && (
                    <a
                      href={settingsData.advertising_sources.social_ads.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Link
                    </a>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="Source URL (optional)"
                  value={settingsData.advertising_sources?.social_ads?.source_url || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      social_ads: { ...settingsData.advertising_sources?.social_ads, source_url: e.target.value }
                    }
                  })}
                />
                <Input
                  type="text"
                  placeholder="Notes (e.g., 'Rates vary by platform')"
                  value={settingsData.advertising_sources?.social_ads?.notes || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      social_ads: { ...settingsData.advertising_sources?.social_ads, notes: e.target.value }
                    }
                  })}
                />
              </div>

              {/* Google Ads */}
              <div className="p-4 bg-stone-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Google Ads</Label>
                  {settingsData.advertising_sources?.google_ads?.source_url && (
                    <a
                      href={settingsData.advertising_sources.google_ads.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Official Page
                    </a>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="Source URL"
                  value={settingsData.advertising_sources?.google_ads?.source_url || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      google_ads: { ...settingsData.advertising_sources?.google_ads, source_url: e.target.value }
                    }
                  })}
                />
                <Input
                  type="text"
                  placeholder="Notes (optional)"
                  value={settingsData.advertising_sources?.google_ads?.notes || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      google_ads: { ...settingsData.advertising_sources?.google_ads, notes: e.target.value }
                    }
                  })}
                />
              </div>

              {/* Influencer / Affiliate */}
              <div className="p-4 bg-stone-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Influencer / Affiliate</Label>
                  {settingsData.advertising_sources?.influencer_affiliate?.source_url && (
                    <a
                      href={settingsData.advertising_sources.influencer_affiliate.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Link
                    </a>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="Source URL (optional)"
                  value={settingsData.advertising_sources?.influencer_affiliate?.source_url || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      influencer_affiliate: { ...settingsData.advertising_sources?.influencer_affiliate, source_url: e.target.value }
                    }
                  })}
                />
                <Input
                  type="text"
                  placeholder="Notes (e.g., 'No fixed platform fees')"
                  value={settingsData.advertising_sources?.influencer_affiliate?.notes || ""}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    advertising_sources: {
                      ...settingsData.advertising_sources,
                      influencer_affiliate: { ...settingsData.advertising_sources?.influencer_affiliate, notes: e.target.value }
                    }
                  })}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Auto-categorization Rules */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-stone-900">Auto-Categorization Rules</h3>
            </div>
            {/* Add Rule */}
            <div className="flex gap-3">
            <Input
              placeholder="Keyword (e.g., 'Amazon')"
              value={newRule.keyword}
              onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
              className="flex-1"
            />
            <Select
              value={newRule.category}
              onValueChange={(v) => setNewRule({ ...newRule, category: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
              <Button onClick={handleAddRule} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Rules List */}
            {settingsData.auto_categorization_rules.length > 0 && (
              <div className="space-y-2">
              {settingsData.auto_categorization_rules.map((rule, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">"{rule.keyword}"</span>
                    <span className="text-stone-400">→</span>
                    <span className="capitalize text-stone-600">{rule.category?.replace(/_/g, " ")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRule(index)}
                    className="text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Machine Form Dialog */}
      <Dialog open={machineFormOpen} onOpenChange={setMachineFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMachine ? "Edit Machine" : "Add Machine"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Brand *</Label>
                <Select
                  value={machineData.brand}
                  onValueChange={(v) => setMachineData({ ...machineData, brand: v, model: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand..." />
                  </SelectTrigger>
                  <SelectContent>
                    {machineBrands.map((brand) => (
                      <SelectItem key={brand.value} value={brand.value}>
                        {brand.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model *</Label>
                <Select
                  value={machineData.model}
                  onValueChange={(v) => setMachineData({ ...machineData, model: v, name: `${machineBrands.find(b => b.value === machineData.brand)?.label || ""} ${v}`.trim() })}
                  disabled={!machineData.brand}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {machineData.brand && machineModels[machineData.brand]?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Machine Name (auto-generated)</Label>
                <Input
                  value={machineData.name}
                  onChange={(e) => setMachineData({ ...machineData, name: e.target.value })}
                  placeholder="Will auto-fill from brand + model"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={machineData.type}
                  onValueChange={(v) => setMachineData({ ...machineData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laser">Laser</SelectItem>
                    <SelectItem value="cnc">CNC</SelectItem>
                    <SelectItem value="printer">3D Printer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Power (Watts)</Label>
                <Input
                  type="number"
                  value={machineData.wattage}
                  onChange={(e) => setMachineData({ ...machineData, wattage: e.target.value })}
                  placeholder="45"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hourly Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={machineData.hourly_rate}
                  onChange={(e) => setMachineData({ ...machineData, hourly_rate: e.target.value })}
                  placeholder="5.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={machineData.purchase_price}
                  onChange={(e) => setMachineData({ ...machineData, purchase_price: e.target.value })}
                  placeholder="6000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={machineData.purchase_date}
                  onChange={(e) => setMachineData({ ...machineData, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Depreciation (Years)</Label>
                <Input
                  type="number"
                  min="1"
                  value={machineData.depreciation_years}
                  onChange={(e) => setMachineData({ ...machineData, depreciation_years: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMachineFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => machineMutation.mutate(machineData)}
              disabled={machineMutation.isPending || !machineData.brand || !machineData.model}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {machineMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingMachine ? "Save Changes" : "Add Machine"}
            </Button>
          </DialogFooter>
          </DialogContent>
          </Dialog>

          {/* Fee Change Log Dialog */}
          <Dialog open={feeChangeLogOpen} onOpenChange={setFeeChangeLogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Processor Fee Change Log</DialogTitle>
            <DialogDescription>
              Historical record of all payment processor fee changes tracked in this system
            </DialogDescription>
          </DialogHeader>

          {feeChangeLogs.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              <History className="w-12 h-12 mx-auto mb-3 text-stone-400" />
              <p>No fee changes recorded yet</p>
              <p className="text-sm mt-1">Changes will appear here when you update fee rates</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feeChangeLogs.map((log) => (
                <div key={log.id} className="p-4 bg-stone-50 rounded-lg border border-stone-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="capitalize">
                          {log.fee_type.replace(/_/g, ' ')}
                        </Badge>
                        {log.country && (
                          <Badge variant="outline">{log.country}</Badge>
                        )}
                        <span className="text-xs text-stone-500">
                          {format(new Date(log.change_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm mb-1">
                        <span className="text-stone-600">
                          {log.fee_type.includes('percent') ? `${log.old_value}%` : `$${log.old_value}`}
                        </span>
                        <span className="text-stone-400">→</span>
                        <span className="font-semibold text-stone-900">
                          {log.fee_type.includes('percent') ? `${log.new_value}%` : `$${log.new_value}`}
                        </span>
                      </div>
                      {log.notes && (
                        <p className="text-xs text-stone-600 mt-2">{log.notes}</p>
                      )}
                    </div>
                    {log.source_url && (
                      <a
                        href={log.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 ml-4"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setFeeChangeLogOpen(false)}>Close</Button>
          </DialogFooter>
          </DialogContent>
          </Dialog>
          </div>
          );
          }