import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Save, Loader2, Zap, Settings as SettingsIcon, CircleDollarSign, History, ExternalLink, AlertTriangle, Eye, EyeOff, MapPin, Sparkles, Wand2 } from "lucide-react";
import { format } from "date-fns";
import { ALL_EXPENSE_CATEGORIES } from "@/components/shared/expenseCategories";
import { US_STATES, getRateForState, NATIONAL_AVG_RATE } from "@/components/tools/electricityRates";

export default function SettingsTool() { 
  const { user } = useAuth();
  const [machineFormOpen, setMachineFormOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feeChangeLogOpen, setFeeChangeLogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const [settingsData, setSettingsData] = useState({
    electricity_rate: 0,
    monthly_overhead: 0,
    default_markup: 0,
    business_name: "",
    user_name: "",
    business_logo_url: "",
    etsy_listing_fee: 0.20,
    etsy_transaction_fee_percent: 6.5,
    payment_processing_fee_percent: 3.0,
    payment_processing_fee_fixed: 0.25,
    paypal_fee_percent: 2.99,
    paypal_fee_fixed: 0.49,
    square_fee_percent: 3.3,
    square_fee_fixed: 0.30,
    venmo_business_fee_percent: 1.9,
    venmo_business_fee_fixed: 0.10,
    squarespace_fee_percent: 2.9,
    squarespace_fee_fixed: 0.30,
    shopify_fee_percent: 2.9,
    shopify_fee_fixed: 0.30,
    fee_country: "US",
    fee_source_url: "https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy",
    fees_last_verified_date: "",
    paypal_source_url: "https://www.paypal.com/us/business/paypal-business-fees",
    paypal_last_verified_date: "",
    square_source_url: "https://squareup.com/help/us/en/article/5068-what-are-square-s-fees",
    square_last_verified_date: "",
    venmo_source_url: "https://help.venmo.com/cs/articles/business-profile-transaction-fees-vhel221",
    venmo_last_verified_date: "",
    squarespace_source_url: "https://support.squarespace.com/hc/en-us/articles/27853679334157-Transaction-fees-and-payment-processing-rates",
    squarespace_last_verified_date: "",
    shopify_source_url: "https://www.shopify.com/pricing",
    shopify_last_verified_date: "",
    share_save_rate_pct: 4.0,
    share_save_source_url: "https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy",
    advertising_type: "none",
    etsy_ads_rate: 0,
    etsy_ads_rate_type: "percent",
    offsite_ads_rate: 15,
    auto_categorization_rules: [],
    tool_name_tags_enabled: false,
    tool_svg_enabled: false,
    tool_raster_enabled: false,
    location_state: "",
    auto_calc_overhead: true,
    monthly_machine_hours: 40,
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
    { value: "brother", label: "Brother" },
    { value: "cricut", label: "Cricut" },
    { value: "creality", label: "Creality" },
    { value: "epilog", label: "Epilog" },
    { value: "fsl", label: "Full Spectrum Laser" },
    { value: "generic", label: "Generic/K40" },
    { value: "glowforge", label: "Glowforge" },
    { value: "graphtec", label: "Graphtec" },
    { value: "laserpecker", label: "LaserPecker" },
    { value: "longer", label: "Longer" },
    { value: "monport", label: "Monport" },
    { value: "omtech", label: "OMTech" },
    { value: "ortur", label: "Ortur" },
    { value: "roland", label: "Roland" },
    { value: "silhouette", label: "Silhouette" },
    { value: "sizzix", label: "Sizzix" },
    { value: "thunder", label: "Thunder Laser" },
    { value: "trotec", label: "Trotec" },
    { value: "uscutter", label: "USCutter" },
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
    brother: ["ScanNCut SDX85", "ScanNCut SDX125", "ScanNCut DX", "Other"],
    cricut: ["Maker", "Maker 3", "Explore 3", "Explore Air 2", "Venture", "Joy", "Joy Xtra", "Other"],
    graphtec: ["CE6000", "CE7000", "FC9000", "Other"],
    roland: ["GR-540", "GX-24", "BN2-20", "BN2-20A", "Other"],
    silhouette: ["Cameo 4", "Cameo 5", "Cameo Plus", "Cameo Pro", "Portrait 3", "Portrait 4", "Other"],
    sizzix: ["Big Shot", "Vagabond 2", "Other"],
    uscutter: ["MH Series", "SC2", "LM2", "Titan 3", "Other"],
    other: ["Custom"],
  };

  const defaultWattage = {
    cricut: { "Maker": 120, "Maker 3": 120, "Explore 3": 65, "Explore Air 2": 65, "Venture": 200, "Joy": 35, "Joy Xtra": 50 },
    silhouette: { "Cameo 4": 65, "Cameo 5": 65, "Cameo Plus": 80, "Cameo Pro": 100, "Portrait 3": 35, "Portrait 4": 35 },
    brother: { "ScanNCut SDX85": 50, "ScanNCut SDX125": 50, "ScanNCut DX": 50 },
    sizzix: { "Big Shot": 0, "Vagabond 2": 0 },
    uscutter: { "MH Series": 100, "SC2": 100, "LM2": 100, "Titan 3": 150 },
    graphtec: { "CE6000": 100, "CE7000": 100, "FC9000": 200 },
    roland: { "GR-540": 200, "GX-24": 100, "BN2-20": 100, "BN2-20A": 100 },
  };

  const isVinylCutterBrand = (brand) => ["cricut", "silhouette", "brother", "sizzix", "uscutter", "graphtec", "roland"].includes(brand);

  const [newRule, setNewRule] = useState({ keyword: "", category: "other" });
  const [learningRules, setLearningRules] = useState(false);
  const [learnedCount, setLearnedCount] = useState(null);

  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
    enabled: !!user,
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ["machines", user?.id],
    queryFn: () => base44.entities.Machine.filter({ owner_user_id: user.id }),
    enabled: !!user,
  });

  const { data: feeChangeLogs = [] } = useQuery({
    queryKey: ["fee-change-logs", user?.id],
    queryFn: () => base44.entities.FeeChangeLog.filter({ owner_user_id: user.id }, "-created_date", 50),
    enabled: !!user,
  });

  useEffect(() => {
    if (settings.length > 0) {
      const s = settings[0];
      setSettingsData({
        electricity_rate: s.electricity_rate ?? 0,
        monthly_overhead: s.monthly_overhead || 0,
        default_markup: s.default_markup || 0,
        business_name: s.business_name || "",
        user_name: s.user_name || "",
        business_logo_url: s.business_logo_url || "",
        etsy_listing_fee: s.etsy_listing_fee ?? 0.20,
        etsy_transaction_fee_percent: s.etsy_transaction_fee_percent ?? 6.5,
        payment_processing_fee_percent: s.payment_processing_fee_percent ?? 3.0,
        payment_processing_fee_fixed: s.payment_processing_fee_fixed ?? 0.25,
        paypal_fee_percent: s.paypal_fee_percent ?? 2.99,
        paypal_fee_fixed: s.paypal_fee_fixed ?? 0.49,
        square_fee_percent: s.square_fee_percent ?? 3.3,
        square_fee_fixed: s.square_fee_fixed ?? 0.30,
        venmo_business_fee_percent: s.venmo_business_fee_percent ?? 1.9,
        venmo_business_fee_fixed: s.venmo_business_fee_fixed ?? 0.10,
        squarespace_fee_percent: s.squarespace_fee_percent ?? 2.9,
        squarespace_fee_fixed: s.squarespace_fee_fixed ?? 0.30,
        shopify_fee_percent: s.shopify_fee_percent ?? 2.9,
        shopify_fee_fixed: s.shopify_fee_fixed ?? 0.30,
        fee_country: s.fee_country || "US",
        fee_source_url: s.fee_source_url || "https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy",
        fees_last_verified_date: s.fees_last_verified_date || "",
        paypal_source_url: s.paypal_source_url || "https://www.paypal.com/us/business/paypal-business-fees",
        paypal_last_verified_date: s.paypal_last_verified_date || "",
        square_source_url: s.square_source_url || "https://squareup.com/help/us/en/article/5068-what-are-square-s-fees",
        square_last_verified_date: s.square_last_verified_date || "",
        venmo_source_url: s.venmo_source_url || "https://help.venmo.com/cs/articles/business-profile-transaction-fees-vhel221",
        venmo_last_verified_date: s.venmo_last_verified_date || "",
        squarespace_source_url: s.squarespace_source_url || "https://support.squarespace.com/hc/en-us/articles/27853679334157-Transaction-fees-and-payment-processing-rates",
        squarespace_last_verified_date: s.squarespace_last_verified_date || "",
        shopify_source_url: s.shopify_source_url || "https://www.shopify.com/pricing",
        shopify_last_verified_date: s.shopify_last_verified_date || "",
        share_save_rate_pct: s.share_save_rate_pct ?? 4.0,
        share_save_source_url: s.share_save_source_url || "https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy",
        advertising_type: s.advertising_type || "none",
        etsy_ads_rate: s.etsy_ads_rate || 0,
        etsy_ads_rate_type: s.etsy_ads_rate_type || "percent",
        offsite_ads_rate: s.offsite_ads_rate || 15,
        auto_categorization_rules: s.auto_categorization_rules || [],
        tool_name_tags_enabled: s.tool_name_tags_enabled || false,
        tool_svg_enabled: s.tool_svg_enabled || false,
        tool_raster_enabled: s.tool_raster_enabled || false,
        location_state: s.location_state || "",
        auto_calc_overhead: s.auto_calc_overhead !== false,
        monthly_machine_hours: s.monthly_machine_hours ?? 40,
        });
    }
  }, [settings]);

  // Auto-calculate electricity rate and monthly overhead based on machines + location
  useEffect(() => {
    if (!settingsData.auto_calc_overhead) return;
    const rate = settingsData.location_state
      ? getRateForState(settingsData.location_state)
      : NATIONAL_AVG_RATE;
    const hours = settingsData.monthly_machine_hours || 40;
    const totalDepreciation = machines.reduce((sum, m) => sum + (m.monthly_depreciation || 0), 0);
    const totalElectricity = machines.reduce((sum, m) => {
      const watts = m.wattage || 0;
      return sum + (watts / 1000) * hours * rate;
    }, 0);
    const calculatedOverhead = Math.round((totalDepreciation + totalElectricity) * 100) / 100;
    setSettingsData(prev => {
      // Only update if values actually changed to avoid infinite loops
      if (prev.electricity_rate === rate && prev.monthly_overhead === calculatedOverhead) return prev;
      return { ...prev, electricity_rate: Math.round(rate * 10000) / 10000, monthly_overhead: calculatedOverhead };
    });
  }, [machines, settingsData.location_state, settingsData.auto_calc_overhead, settingsData.monthly_machine_hours]);

  const settingsMutation = useMutation({
    mutationFn: async (data) => {
      const oldSettings = settings[0] || {};
      
      // Track fee changes
      const feeFields = [
        { key: "etsy_listing_fee", label: "listing_fee" },
        { key: "etsy_transaction_fee_percent", label: "transaction_fee" },
        { key: "payment_processing_fee_percent", label: "processing_fee_percent" },
        { key: "payment_processing_fee_fixed", label: "processing_fee_fixed" },
        { key: "share_save_rate_pct", label: "share_save_rate" },
      ];
      
      for (const field of feeFields) {
        const oldValue = oldSettings[field.key];
        const newValue = data[field.key];
        
        if (oldValue !== undefined && newValue !== undefined && oldValue !== newValue) {
          await base44.entities.FeeChangeLog.create({
            owner_user_id: user.id,
            fee_type: field.label,
            old_value: oldValue,
            new_value: newValue,
            country: data.fee_country || "US",
            source_url: data.fee_source_url || "",
            change_date: new Date().toISOString().split('T')[0],
            notes: `Updated from ${oldValue} to ${newValue}`,
          });
        }
      }
      
      if (settings.length > 0) {
        return base44.entities.Settings.update(settings[0].id, data);
      }
      return base44.entities.Settings.create({ ...data, owner_user_id: user.id, setting_key: "default" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["fee-change-logs"] });
      setSaving(false);
    },
  });

  const machineMutation = useMutation({
    mutationFn: async (data) => {
      if (!user) throw new Error("Please sign in to save a machine.");
      const payload = {
        ...data,
        owner_user_id: user.id,
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
        brand: "",
        model: "",
        type: "laser",
        wattage: "",
        hourly_rate: "",
        purchase_price: "",
        purchase_date: "",
        depreciation_years: 5,
      });
    },
    onError: (err) => {
      alert("Error saving machine: " + (err?.message || "Please sign in to the app first."));
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

  const handleLearnFromExpenses = async () => {
    if (!user) return;
    setLearningRules(true);
    setLearnedCount(null);
    try {
      const expenses = await base44.entities.BusinessExpense.filter({ owner_user_id: user.id }, '-created_date', 10000);
      const vendorMap = {};
      for (const exp of expenses) {
        if (!exp.category_name || exp.category_name === 'other' || exp.category_name === 'miscellaneous_expenses') continue;
        const keyword = (exp.vendor || exp.description || '').trim();
        if (!keyword) continue;
        const key = keyword.toLowerCase();
        if (!vendorMap[key]) vendorMap[key] = { keyword, category_counts: {}, total: 0 };
        vendorMap[key].category_counts[exp.category_name] = (vendorMap[key].category_counts[exp.category_name] || 0) + 1;
        vendorMap[key].total++;
      }

      const existingKeywords = new Set((settingsData.auto_categorization_rules || []).map(r => r.keyword?.toLowerCase()));
      const newRules = [];
      for (const { keyword, category_counts, total } of Object.values(vendorMap)) {
        if (existingKeywords.has(keyword.toLowerCase())) continue;
        const bestCategory = Object.entries(category_counts).sort((a, b) => b[1] - a[1])[0][0];
        newRules.push({ keyword, category: bestCategory, _count: total });
      }
      newRules.sort((a, b) => b._count - a._count);
      newRules.forEach(r => delete r._count);

      const merged = [...settingsData.auto_categorization_rules, ...newRules];
      setSettingsData(prev => ({ ...prev, auto_categorization_rules: merged }));
      setLearnedCount(newRules.length);
    } catch (err) {
      alert("Failed to learn from expenses: " + (err?.message || ""));
    } finally {
      setLearningRules(false);
    }
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

  const handleResetApp = async () => {
    setResetting(true);
    try {
      // Delete all entities - fetch ALL records with high limit
      const entitiesToDelete = [
        'EtsyOrder', 'OrderFee', 'Fee', 'EtsyStatementImport', 'EtsyStatementLine',
        'EtsyLedgerEntry', 'BusinessExpense', 'Expense', 'Order', 'Quote', 'Customer',
        'Job', 'Product', 'MaterialType', 'MaterialSheet', 'MaterialUsage', 'MaterialPurchase',
        'Machine', 'LaserSetting', 'CustomSale', 'Transfer', 'InventoryItem', 'InventoryTransaction',
        'BudgetPlan', 'BudgetLine', 'FeeChangeLog', 'OrderImportBatch'
      ];

      console.log('Starting app reset...');
      
      for (const entityName of entitiesToDelete) {
        try {
          console.log(`Deleting ${entityName}...`);
          // Fetch only current user's records
          const records = await base44.entities[entityName].filter({ owner_user_id: user.id }, '-created_date', 10000);
          console.log(`Found ${records.length} ${entityName} records`);
          
          if (records && records.length > 0) {
            // Delete in batches to avoid overwhelming the system
            const batchSize = 50;
            for (let i = 0; i < records.length; i += batchSize) {
              const batch = records.slice(i, i + batchSize);
              await Promise.all(batch.map(r => base44.entities[entityName].delete(r.id)));
              console.log(`Deleted ${Math.min(i + batchSize, records.length)}/${records.length} ${entityName}`);
            }
          }
        } catch (err) {
          console.error(`Failed to delete ${entityName}:`, err);
        }
      }

      // Reset settings to defaults
      if (settings.length > 0) {
        await base44.entities.Settings.update(settings[0].id, {
          owner_user_id: user.id,
          electricity_rate: 0,
          monthly_overhead: 0,
          default_markup: 0,
          business_name: "",
          user_name: "",
          etsy_listing_fee: 0.20,
          etsy_transaction_fee_percent: 6.5,
          payment_processing_fee_percent: 3.0,
          payment_processing_fee_fixed: 0.25,
          auto_categorization_rules: [],
          advertising_type: "none"
        });
      }

      console.log('Reset complete, reloading...');
      
      // Clear all query cache
      queryClient.clear();
      setResetDialogOpen(false);
      
      // Force reload
      window.location.href = window.location.href;
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Reset failed. Check console for details: ' + error.message);
      setResetting(false);
    }
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
          {/* Business Profile */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-stone-900">Business Profile</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  value={settingsData.business_name}
                  onChange={(e) => setSettingsData({ ...settingsData, business_name: e.target.value })}
                  placeholder="Your Shop Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input
                  value={settingsData.user_name}
                  onChange={(e) => setSettingsData({ ...settingsData, user_name: e.target.value })}
                  placeholder="Your Name"
                />
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <Label>Business Logo for Quotes & Invoices</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    setSettingsData({ ...settingsData, business_logo_url: file_url });
                  }
                }}
              />
              {settingsData.business_logo_url && (
                <div className="mt-2 p-2 border rounded-lg bg-white">
                  <img src={settingsData.business_logo_url} alt="Business Logo" className="h-16 object-contain" />
                </div>
              )}
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
                    <TableCell className="capitalize">{machine.type?.replace(/_/g, " ")}</TableCell>
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
                No machines configured. Add your first machine to auto-calculate overhead costs.
              </div>
            )}
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Cost Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-stone-900">Cost Settings</h3>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Sparkles className="w-4 h-4" />
                <span>Electricity rate and monthly overhead auto-calculate based on your machines and location.</span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Auto-Calculate from Machines</Label>
                <button
                  onClick={() => setSettingsData({ ...settingsData, auto_calc_overhead: !settingsData.auto_calc_overhead })}
                  className={`p-2 rounded-lg transition-colors ${
                    settingsData.auto_calc_overhead
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-stone-200 text-stone-400"
                  }`}
                >
                  {settingsData.auto_calc_overhead ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
              {settingsData.auto_calc_overhead && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-stone-500" /> Location (State)</Label>
                    <Select
                      value={settingsData.location_state}
                      onValueChange={(v) => setSettingsData({ ...settingsData, location_state: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your state..." />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-stone-500">
                      Electricity rate: ${settingsData.electricity_rate.toFixed(4)}/kWh
                      {settingsData.location_state ? ` (${settingsData.location_state} avg)` : " (national avg)"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Monthly Machine Hours</Label>
                    <Input
                      type="number"
                      min="0"
                      value={settingsData.monthly_machine_hours}
                      onChange={(e) => setSettingsData({ ...settingsData, monthly_machine_hours: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-stone-500">Hours per month your machines run</p>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Electricity Rate ($/kWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settingsData.electricity_rate}
                  onChange={(e) => setSettingsData({ ...settingsData, electricity_rate: parseFloat(e.target.value) || 0 })}
                  disabled={settingsData.auto_calc_overhead}
                  className={settingsData.auto_calc_overhead ? "bg-stone-50 text-stone-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Overhead ($)</Label>
                <Input
                  type="number"
                  step="1"
                  value={settingsData.monthly_overhead}
                  onChange={(e) => setSettingsData({ ...settingsData, monthly_overhead: parseFloat(e.target.value) || 0 })}
                  disabled={settingsData.auto_calc_overhead}
                  className={settingsData.auto_calc_overhead ? "bg-stone-50 text-stone-500" : ""}
                />
              </div>
            </div>
            {settingsData.auto_calc_overhead && machines.length > 0 && (
              <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-600 space-y-1">
                <div className="font-medium text-stone-700 mb-1">Overhead Breakdown:</div>
                <div>Machine Depreciation: ${machines.reduce((s, m) => s + (m.monthly_depreciation || 0), 0).toFixed(2)}/mo</div>
                <div>Electricity ({machines.reduce((s, m) => s + (m.wattage || 0), 0)}W × {settingsData.monthly_machine_hours || 0}h): ${machines.reduce((s, m) => s + ((m.wattage || 0) / 1000) * (settingsData.monthly_machine_hours || 0) * settingsData.electricity_rate, 0).toFixed(2)}/mo</div>
                <div className="font-medium text-stone-700 pt-1 border-t border-stone-200">Total: ${settingsData.monthly_overhead.toFixed(2)}/mo</div>
              </div>
            )}
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Marketplace Fees */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-stone-900">Payment Processor Fee Rates</h3>
              </div>
              <p className="text-sm text-stone-600">
                These are <strong>default rates for estimates only</strong>. When you import Etsy statements, actual fees from the statement will be used instead of these rates.
                Keep these updated for accurate profit calculations when actual fees are not available.
              </p>
            </div>
            <div className="flex items-center justify-between">
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
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
                <TabsTrigger value="etsy">Etsy</TabsTrigger>
                <TabsTrigger value="paypal">PayPal</TabsTrigger>
                <TabsTrigger value="square">Square</TabsTrigger>
                <TabsTrigger value="venmo">Venmo</TabsTrigger>
                <TabsTrigger value="squarespace">Squarespace</TabsTrigger>
                <TabsTrigger value="shopify">Shopify</TabsTrigger>
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
                    <div className="space-y-2">
                      <Label>Share & Save Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settingsData.share_save_rate_pct ?? 4.0}
                        onChange={(e) => setSettingsData({ ...settingsData, share_save_rate_pct: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Fee credit you receive on Share & Save orders: 4.0%</p>
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
                      <Label className="text-sm font-medium">Share & Save Source</Label>
                      {settingsData.share_save_source_url && (
                        <a
                          href={settingsData.share_save_source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 mb-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Share & Save Official Page
                        </a>
                      )}
                      <Input
                        type="text"
                        placeholder="https://help.etsy.com/..."
                        value={settingsData.share_save_source_url}
                        onChange={(e) => setSettingsData({ ...settingsData, share_save_source_url: e.target.value })}
                      />
                    </div>

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
                        value={settingsData.paypal_fee_percent ?? 2.99}
                        onChange={(e) => setSettingsData({ ...settingsData, paypal_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current US rate: 2.99%</p>
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

                  <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Fee Source</Label>
                      {settingsData.paypal_source_url && (
                        <a
                          href={settingsData.paypal_source_url}
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
                      placeholder="https://www.paypal.com/..."
                      value={settingsData.paypal_source_url}
                      onChange={(e) => setSettingsData({ ...settingsData, paypal_source_url: e.target.value })}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Verified</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={settingsData.paypal_last_verified_date}
                          onChange={(e) => setSettingsData({ ...settingsData, paypal_last_verified_date: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsData({ ...settingsData, paypal_last_verified_date: new Date().toISOString().split('T')[0] })}
                        >
                          Today
                        </Button>
                      </div>
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
                        value={settingsData.square_fee_percent ?? 3.3}
                        onChange={(e) => setSettingsData({ ...settingsData, square_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current online rate: 3.3%</p>
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

                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Fee Source</Label>
                      {settingsData.square_source_url && (
                        <a
                          href={settingsData.square_source_url}
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
                      placeholder="https://squareup.com/..."
                      value={settingsData.square_source_url}
                      onChange={(e) => setSettingsData({ ...settingsData, square_source_url: e.target.value })}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Verified</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={settingsData.square_last_verified_date}
                          onChange={(e) => setSettingsData({ ...settingsData, square_last_verified_date: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsData({ ...settingsData, square_last_verified_date: new Date().toISOString().split('T')[0] })}
                        >
                          Today
                        </Button>
                      </div>
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

                  <div className="mt-4 pt-4 border-t border-sky-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Fee Source</Label>
                      {settingsData.venmo_source_url && (
                        <a
                          href={settingsData.venmo_source_url}
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
                      placeholder="https://help.venmo.com/..."
                      value={settingsData.venmo_source_url}
                      onChange={(e) => setSettingsData({ ...settingsData, venmo_source_url: e.target.value })}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Verified</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={settingsData.venmo_last_verified_date}
                          onChange={(e) => setSettingsData({ ...settingsData, venmo_last_verified_date: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsData({ ...settingsData, venmo_last_verified_date: new Date().toISOString().split('T')[0] })}
                        >
                          Today
                        </Button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-500 mt-3 italic">Note: Venmo Personal, Zelle, and Cash have no processing fees</p>
                </div>
              </TabsContent>

              <TabsContent value="squarespace" className="space-y-4 mt-4">
                <div className="bg-gradient-to-br from-teal-50 to-white p-4 rounded-lg border border-teal-100">
                  <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                    <span className="text-teal-600">⬛</span> Squarespace Payments
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Squarespace Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.squarespace_fee_percent ?? 2.9}
                        onChange={(e) => setSettingsData({ ...settingsData, squarespace_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current rate: 2.9% (all plans)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Squarespace Fixed Fee ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.squarespace_fee_fixed ?? 0.30}
                        onChange={(e) => setSettingsData({ ...settingsData, squarespace_fee_fixed: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current rate: $0.30 per transaction</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-teal-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Fee Source</Label>
                      {settingsData.squarespace_source_url && (
                        <a
                          href={settingsData.squarespace_source_url}
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
                      placeholder="https://www.squarespace.com/..."
                      value={settingsData.squarespace_source_url}
                      onChange={(e) => setSettingsData({ ...settingsData, squarespace_source_url: e.target.value })}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Verified</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={settingsData.squarespace_last_verified_date}
                          onChange={(e) => setSettingsData({ ...settingsData, squarespace_last_verified_date: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsData({ ...settingsData, squarespace_last_verified_date: new Date().toISOString().split('T')[0] })}
                        >
                          Today
                        </Button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-500 mt-3 italic">Note: Same rate (2.9% + $0.30) for Basic, Core, Plus, and Advanced plans</p>
                </div>
              </TabsContent>

              <TabsContent value="shopify" className="space-y-4 mt-4">
                <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-lg border border-green-100">
                  <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                    <span className="text-green-600">🛒</span> Shopify Payments
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Shopify Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.shopify_fee_percent ?? 2.9}
                        onChange={(e) => setSettingsData({ ...settingsData, shopify_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Basic: 2.9%, Shopify: 2.6%, Advanced: 2.4%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Shopify Fixed Fee ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsData.shopify_fee_fixed ?? 0.30}
                        onChange={(e) => setSettingsData({ ...settingsData, shopify_fee_fixed: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-stone-500">Current rate: $0.30 per transaction</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-green-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Fee Source</Label>
                      {settingsData.shopify_source_url && (
                        <a
                          href={settingsData.shopify_source_url}
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
                      placeholder="https://help.shopify.com/..."
                      value={settingsData.shopify_source_url}
                      onChange={(e) => setSettingsData({ ...settingsData, shopify_source_url: e.target.value })}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Verified</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={settingsData.shopify_last_verified_date}
                          onChange={(e) => setSettingsData({ ...settingsData, shopify_last_verified_date: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsData({ ...settingsData, shopify_last_verified_date: new Date().toISOString().split('T')[0] })}
                        >
                          Today
                        </Button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-500 mt-3 italic">Note: Rates vary by plan - Basic (2.9%), Shopify (2.6%), Advanced (2.4%) + $0.30</p>
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

          {/* Advertising (Etsy) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-stone-900">Advertising (Etsy)</h3>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-lg border border-purple-100">
              <p className="text-xs text-stone-600 mb-4">
                Configure Etsy's advertising options. These are selling expenses, separate from payment processing fees.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Advertising Type</Label>
                  <Select 
                    value={settingsData.advertising_type} 
                    onValueChange={(v) => setSettingsData({ ...settingsData, advertising_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="etsy_ads">Etsy Ads</SelectItem>
                      <SelectItem value="offsite_ads">Offsite Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settingsData.advertising_type === "etsy_ads" && (
                  <>
                    <div className="space-y-2">
                      <Label>Etsy Ads Rate</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={settingsData.etsy_ads_rate}
                          onChange={(e) => setSettingsData({ ...settingsData, etsy_ads_rate: parseFloat(e.target.value) || 0 })}
                          className="flex-1"
                        />
                        <Select 
                          value={settingsData.etsy_ads_rate_type} 
                          onValueChange={(v) => setSettingsData({ ...settingsData, etsy_ads_rate_type: v })}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="fixed">$</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-stone-500">
                        {settingsData.etsy_ads_rate_type === "percent" 
                          ? "Percentage of sale price"
                          : "Fixed cost per order"}
                      </p>
                    </div>
                  </>
                )}

                {settingsData.advertising_type === "offsite_ads" && (
                  <div className="space-y-2">
                    <Label>Offsite Ads Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={settingsData.offsite_ads_rate}
                      onChange={(e) => setSettingsData({ ...settingsData, offsite_ads_rate: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-stone-500">
                      Percentage of order revenue (excluding tax), typically 15% for most sellers
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Tools Visibility */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-stone-900">Tools Visibility</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                <div>
                  <Label className="font-medium">Name Tags Tool</Label>
                  <p className="text-xs text-stone-500 mt-1">Show/hide the name tags generator</p>
                </div>
                <button
                  onClick={() => setSettingsData({ ...settingsData, tool_name_tags_enabled: !settingsData.tool_name_tags_enabled })}
                  className={`p-2 rounded-lg transition-colors ${
                    settingsData.tool_name_tags_enabled
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-stone-200 text-stone-400"
                  }`}
                >
                  {settingsData.tool_name_tags_enabled ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                <div>
                  <Label className="font-medium">SVG Converter Tool</Label>
                  <p className="text-xs text-stone-500 mt-1">Show/hide the SVG converter</p>
                </div>
                <button
                  onClick={() => setSettingsData({ ...settingsData, tool_svg_enabled: !settingsData.tool_svg_enabled })}
                  className={`p-2 rounded-lg transition-colors ${
                    settingsData.tool_svg_enabled
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-stone-200 text-stone-400"
                  }`}
                >
                  {settingsData.tool_svg_enabled ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                <div>
                  <Label className="font-medium">Raster Assistant Tool</Label>
                  <p className="text-xs text-stone-500 mt-1">Show/hide the raster settings assistant</p>
                </div>
                <button
                  onClick={() => setSettingsData({ ...settingsData, tool_raster_enabled: !settingsData.tool_raster_enabled })}
                  className={`p-2 rounded-lg transition-colors ${
                    settingsData.tool_raster_enabled
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-stone-200 text-stone-400"
                  }`}
                >
                  {settingsData.tool_raster_enabled ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200"></div>

          {/* Auto-categorization Rules */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-stone-900">Auto-Categorization Rules</h3>
              </div>
              <Button
                onClick={handleLearnFromExpenses}
                disabled={learningRules}
                variant="outline"
                size="sm"
              >
                {learningRules ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Learn from Expenses
              </Button>
            </div>
            <p className="text-sm text-stone-500">
              Rules auto-categorize imported expenses by matching keywords in the vendor or description.
              Click "Learn from Expenses" to scan your categorized expenses and generate rules automatically.
            </p>
            {learnedCount !== null && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700">
                <Sparkles className="w-4 h-4" />
                {learnedCount > 0
                  ? `Generated ${learnedCount} new rule${learnedCount !== 1 ? 's' : ''} from your expenses. Save settings to apply.`
                  : "No new rules found — your existing rules already cover all categorized vendors."}
              </div>
            )}
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
                {ALL_EXPENSE_CATEGORIES.map((cat) => (
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

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <Button
            variant="destructive"
            onClick={() => setResetDialogOpen(true)}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Reset App
          </Button>
          
          <Button
            variant="outline"
            onClick={() => base44.auth.logout()}
          >
            Sign Out
          </Button>
        </div>
        
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
                  onValueChange={(v) => setMachineData({
                    ...machineData,
                    brand: v,
                    model: "",
                    type: isVinylCutterBrand(v) ? "vinyl_cutter" : machineData.type,
                  })}
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
                  onValueChange={(v) => {
                    const dw = defaultWattage[machineData.brand]?.[v];
                    setMachineData({
                      ...machineData,
                      model: v,
                      name: `${machineBrands.find(b => b.value === machineData.brand)?.label || ""} ${v}`.trim(),
                      ...(dw !== undefined && (!machineData.wattage || machineData.wattage === "0") ? { wattage: dw.toString() } : {}),
                    });
                  }}
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
                <Label>Machine Name *</Label>
                <Input
                  value={machineData.name}
                  onChange={(e) => setMachineData({ ...machineData, name: e.target.value })}
                  placeholder="Auto-fills from brand + model, or type a name"
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
                    <SelectItem value="vinyl_cutter">Vinyl Cutter</SelectItem>
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
              disabled={machineMutation.isPending || !machineData.name?.trim()}
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

          {/* Reset App Confirmation Dialog */}
          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                  Reset Entire App
                </DialogTitle>
                <DialogDescription>
                  This will permanently delete ALL data in your app including:
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4">
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                  <ul className="text-sm space-y-2 text-rose-900">
                    <li>• All orders and sales records</li>
                    <li>• All Etsy imports and fees</li>
                    <li>• All expenses and business records</li>
                    <li>• All quotes and customers</li>
                    <li>• All products and inventory</li>
                    <li>• All jobs and production data</li>
                    <li>• All materials and machines</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-900 font-semibold">
                    ⚠️ This action cannot be undone!
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    Settings will be reset to defaults. The app will reload after completion.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setResetDialogOpen(false)}
                  disabled={resetting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetApp}
                  disabled={resetting}
                >
                  {resetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Yes, Delete Everything
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
          );
          }