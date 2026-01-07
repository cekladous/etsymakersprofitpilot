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
import { Plus, Trash2, Save, Loader2, Zap, Settings as SettingsIcon, CircleDollarSign } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

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

export function SettingsTool() {
  const [machineFormOpen, setMachineFormOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [settingsData, setSettingsData] = useState({
    electricity_rate: 0.12,
    monthly_overhead: 0,
    default_markup: 0,
    business_name: "",
    etsy_listing_fee: 0.20,
    etsy_transaction_fee_percent: 6.5,
    payment_processing_fee_percent: 3.0,
    payment_processing_fee_fixed: 0.25,
    fee_country: "US",
    auto_categorization_rules: [],
  });

  const [machineData, setMachineData] = useState({
    name: "",
    type: "laser",
    wattage: "",
    hourly_rate: "",
    purchase_price: "",
    purchase_date: "",
    depreciation_years: 5,
  });

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
        fee_country: s.fee_country || "US",
        auto_categorization_rules: s.auto_categorization_rules || [],
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
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-stone-900">Marketplace Fee Configuration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Etsy Listing Fee ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={settingsData.etsy_listing_fee ?? 0.20}
                onChange={(e) => setSettingsData({ ...settingsData, etsy_listing_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-stone-500">2026 rate: $0.20 per listing</p>
            </div>
            <div className="space-y-2">
              <Label>Etsy Transaction Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={settingsData.etsy_transaction_fee_percent ?? 6.5}
                onChange={(e) => setSettingsData({ ...settingsData, etsy_transaction_fee_percent: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-stone-500">2026 rate: 6.5% of price + shipping</p>
            </div>
            <div className="space-y-2">
              <Label>Payment Processing Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={settingsData.payment_processing_fee_percent ?? 3.0}
                onChange={(e) => setSettingsData({ ...settingsData, payment_processing_fee_percent: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-stone-500">2026 US rate: 3.0%</p>
            </div>
            <div className="space-y-2">
              <Label>Payment Processing Fixed Fee ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={settingsData.payment_processing_fee_fixed ?? 0.25}
                onChange={(e) => setSettingsData({ ...settingsData, payment_processing_fee_fixed: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-stone-500">2026 US rate: $0.25 per order</p>
            </div>
          </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">💡 Current 2026 Etsy Fees (US)</p>
              <p>• Listing: $0.20 per item</p>
              <p>• Transaction: 6.5% of item price + shipping</p>
              <p>• Payment Processing: 3% + $0.25</p>
              <p className="pt-2 text-xs">These rates are used in the Profit Calculator and applied when auto-calculating order fees. Update them if you're in a different country or marketplace.</p>
            </div>
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
              <div className="space-y-2 col-span-2">
                <Label>Machine Name *</Label>
                <Input
                  value={machineData.name}
                  onChange={(e) => setMachineData({ ...machineData, name: e.target.value })}
                  placeholder="Glowforge Pro"
                  required
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
              disabled={machineMutation.isPending || !machineData.name}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {machineMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingMachine ? "Save Changes" : "Add Machine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SettingsTool;