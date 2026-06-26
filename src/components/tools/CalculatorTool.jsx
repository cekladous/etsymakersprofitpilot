import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator as CalcIcon, DollarSign, TrendingUp, Percent, ArrowRight, ExternalLink, Info, RotateCcw, Save, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { calculateProfit, formatCurrency, formatPercent } from "@/components/shared/profitCalculator";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const defaultInputs = {
  sales_price: 25.00,
  shipping_charged: 5.00,
  discounts: 0,
  discounts_type: "fixed",
  refunds: 0,
  sales_tax: 0,
  cost_of_goods: 8.00,
  shipping_cost: 0,
  overhead_cost: 0,
  labor_hours: 0,
  labor_rate: 0,
  advertising_type: "none",
  advertising_value: 0,
  advertising_value_type: "percent",
  share_save_enabled: false,
  share_save_discount: 10,
  share_save_discount_type: "percent",
  share_save_fee_rate: 4,
  payment_method: "etsy",
};

export default function CalculatorTool() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState(defaultInputs);
  const [shareSaveExpanded, setShareSaveExpanded] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
  });

  const feeConfig = settings[0] || {};
  const laborCost = (parseFloat(inputs.labor_hours) || 0) * (parseFloat(inputs.labor_rate) || 0);
  const totalCogs = (parseFloat(inputs.cost_of_goods) || 0) + laborCost;
  const results = calculateProfit({ ...inputs, cost_of_goods: totalCogs, labor_cost: 0 }, feeConfig);

  const handleInputChange = (field, value) => {
    setInputs(prev => ({
      ...prev,
      [field]: typeof value === 'boolean' ? value : (typeof value === 'string' && isNaN(parseFloat(value)) ? value : (parseFloat(value) || 0)),
    }));
  };

  const handleSelectChange = (field, value) => {
    setInputs(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReset = () => {
    setInputs(defaultInputs);
  };

  const saveDefaultsMutation = useMutation({
    mutationFn: async () => {
      const settingId = settings[0]?.id;
      const payload = {
        ...settings[0],
        calculator_defaults: inputs,
      };
      if (settingId) {
        return base44.entities.Settings.update(settingId, payload);
      } else {
        return base44.entities.Settings.create({ setting_key: "main", calculator_defaults: inputs });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      alert("Default values saved!");
    },
  });

  const handleSaveDefaults = () => {
    saveDefaultsMutation.mutate();
  };

  const handleCreateQuote = async () => {
    const grandTotal = results.profit + results.total_fees + totalCosts;
    
    const quoteNumber = `Q-${Date.now()}`;
    await base44.entities.Quote.create({
      quote_number: quoteNumber,
      project_name: "New Quote from Calculator",
      customer_name: "",
      status: "Draft",
      materials: [{
        name: "Materials & Supplies",
        cost: inputs.cost_of_goods
      }, {
        name: "Labor",
        cost: laborCost
      }],
      machines: [],
      labor_hours: inputs.labor_hours,
      labor_rate: inputs.labor_rate,
      notes: `Sales Price: $${inputs.sales_price}\nShipping: $${inputs.shipping_charged}\nEstimated Fees: $${results.total_fees.toFixed(2)}\nEstimated Profit: $${results.profit.toFixed(2)} (${results.profit_margin != null ? `${results.profit_margin.toFixed(1)}%` : 'N/A'})\n\nPayment Method: ${inputs.payment_method}`,
    });
    
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    navigate(createPageUrl("Quotes"));
  };

  // Chart data
  const totalCosts = results.cost_of_goods + (inputs.shipping_cost || 0) + (inputs.overhead_cost || 0);
  const chartData = [
    { name: "Net Profit", value: Math.max(0, results.profit), color: "#10b981" },
    { name: "Fees", value: results.total_fees, color: "#ef4444" },
    { name: "Costs", value: totalCosts, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  const KPICard = ({ label, value, subtext, color = "text-stone-900", bgColor = "bg-white" }) => (
    <Card className={`${bgColor} border-2`}>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-3xl font-bold ${color} mb-1`}>{value}</p>
        {subtext && <p className="text-xs text-stone-500">{subtext}</p>}
      </CardContent>
    </Card>
  );

  const BreakdownRow = ({ label, amount, bold = false, indent = false }) => (
    <div className={`flex justify-between items-center py-2 ${bold ? "font-semibold" : ""}`}>
      <span className={`text-sm ${indent ? "pl-4 text-stone-600" : bold ? "text-stone-900" : "text-stone-700"}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? "text-stone-900 font-bold" : "text-stone-700"}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Profit Calculator</h2>
          <p className="text-stone-500 text-sm mt-1">Calculate your net profit after fees and costs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDefaults}>
            <Save className="w-4 h-4 mr-2" />
            Save Defaults
          </Button>
          <Button size="sm" onClick={handleCreateQuote} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Quote
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <span className="font-semibold">Using current Settings rates</span> • Fee rates, payment processors, and advertising sources are configured in the Settings tab
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inputs (5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sales Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.sales_price}
                  onChange={(e) => handleInputChange("sales_price", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Shipping Charged</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.shipping_charged}
                  onChange={(e) => handleInputChange("shipping_charged", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Discounts</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inputs.discounts}
                    onChange={(e) => handleInputChange("discounts", e.target.value)}
                    className="h-11 flex-1"
                  />
                  <Select value={inputs.discounts_type || "fixed"} onValueChange={(v) => handleSelectChange("discounts_type", v)}>
                    <SelectTrigger className="h-11 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">$</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Refunds</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.refunds}
                  onChange={(e) => handleInputChange("refunds", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sales Tax (excluded)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.sales_tax}
                  onChange={(e) => handleInputChange("sales_tax", e.target.value)}
                  className="h-11"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Costs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Materials & Supplies</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.cost_of_goods}
                  onChange={(e) => handleInputChange("cost_of_goods", e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-stone-500">Materials and packaging cost per item</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Shipping Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.shipping_cost}
                  onChange={(e) => handleInputChange("shipping_cost", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Overhead per Item ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.overhead_cost}
                  onChange={(e) => handleInputChange("overhead_cost", e.target.value)}
                  className="h-11"
                  placeholder="0.00"
                />
                <p className="text-xs text-stone-500">Allocated overhead per item (utilities, rent, equipment depreciation, etc.)</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Labor</Label>
                  <span className="text-sm font-semibold text-stone-700">{formatCurrency(laborCost)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputs.labor_hours}
                      onChange={(e) => handleInputChange("labor_hours", e.target.value)}
                      className="h-11"
                      placeholder="0"
                    />
                    <p className="text-xs text-stone-400 mt-1 text-center">hours (e.g. 2.5)</p>
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputs.labor_rate}
                      onChange={(e) => handleInputChange("labor_rate", e.target.value)}
                      className="h-11"
                      placeholder="50.00"
                    />
                    <p className="text-xs text-stone-400 mt-1 text-center">$/hr (e.g. 15.00)</p>
                  </div>
                </div>
                <p className="text-xs text-stone-500">Labor cost = hours × rate</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Advertising</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Advertising Type</Label>
                <Select value={inputs.advertising_type} onValueChange={(v) => handleSelectChange("advertising_type", v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="etsy_ads">Etsy Ads</SelectItem>
                    <SelectItem value="etsy_offsite_ads">Etsy Offsite Ads</SelectItem>
                    <SelectItem value="social_ads">Social Ads (Meta / TikTok / Pinterest paid ads)</SelectItem>
                    <SelectItem value="google_ads">Google Ads (Search / Shopping driving to Etsy or site)</SelectItem>
                    <SelectItem value="influencer_affiliate">Influencer / Affiliate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inputs.advertising_type !== "none" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {inputs.advertising_type === "etsy_ads" && "Average Cost of Sale"}
                    {inputs.advertising_type === "etsy_offsite_ads" && "Offsite Ads Rate"}
                    {inputs.advertising_type === "social_ads" && "Social Ads Cost"}
                    {inputs.advertising_type === "google_ads" && "Google Ads Cost"}
                    {inputs.advertising_type === "influencer_affiliate" && "Commission / Fee"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputs.advertising_value}
                      onChange={(e) => handleInputChange("advertising_value", e.target.value)}
                      className="h-11 flex-1"
                    />
                    <Select value={inputs.advertising_value_type} onValueChange={(v) => handleSelectChange("advertising_value_type", v)}>
                      <SelectTrigger className="h-11 w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">$</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {inputs.advertising_type === "etsy_offsite_ads" && (
                    <p className="text-xs text-stone-500">Percentage of order revenue (excluding tax)</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-stone-50 transition-colors"
              onClick={() => setShareSaveExpanded(!shareSaveExpanded)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Etsy Share & Save Calculator</CardTitle>
                  <CardDescription className="text-xs mt-1">Optional tool to calculate Share & Save impact</CardDescription>
                </div>
                {shareSaveExpanded ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
              </div>
            </CardHeader>
            {shareSaveExpanded && (
              <CardContent className="space-y-4 pt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <span className="font-semibold">What is Share & Save?</span> Etsy's discount program where you save 4% on listing fees for discounted orders. This increases conversion while keeping more profit.
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Enable Share & Save</Label>
                    <p className="text-xs text-stone-500 mt-1">Toggle on to see impact on profit</p>
                  </div>
                  <Switch
                    checked={inputs.share_save_enabled}
                    onCheckedChange={(checked) => handleInputChange("share_save_enabled", checked)}
                  />
                </div>

                {inputs.share_save_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Share & Save Discount</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={inputs.share_save_discount}
                          onChange={(e) => handleInputChange("share_save_discount", e.target.value)}
                          className="h-11 flex-1"
                        />
                        <Select value={inputs.share_save_discount_type} onValueChange={(v) => handleSelectChange("share_save_discount_type", v)}>
                          <SelectTrigger className="h-11 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="fixed">$</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Share & Save Credit Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={inputs.share_save_fee_rate || feeConfig?.share_save_rate_pct || 4}
                        onChange={(e) => handleInputChange("share_save_fee_rate", e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-stone-500">Fee credit you receive on Share & Save orders (default: 4%)</p>
                    </div>

                    {/* Share & Save Impact Summary */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-900">Share & Save Impact:</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-emerald-700">Original Sale Price:</span>
                          <span className="font-medium text-emerald-900">{formatCurrency(results.original_sale_price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-700">Share & Save Discount:</span>
                          <span className="font-medium text-emerald-900">-{formatCurrency(results.share_save_discount_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-700">Discounted Sale Price:</span>
                          <span className="font-medium text-emerald-900">{formatCurrency(results.discounted_sale_price)}</span>
                        </div>
                        <div className="flex justify-between border-t border-emerald-300 pt-1 mt-1">
                         <span className="text-emerald-700">Share & Save Credit ({feeConfig?.share_save_rate_pct || 4}% you keep):</span>
                         <span className="font-medium text-emerald-600">+{formatCurrency(results.share_save_fee)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Processor</Label>
                <Select value={inputs.payment_method} onValueChange={(v) => handleSelectChange("payment_method", v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="etsy">Etsy Payments</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="venmo_business">Venmo (Business)</SelectItem>
                    <SelectItem value="venmo_personal">Venmo (Personal)</SelectItem>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-stone-500">
                  {inputs.payment_method === "etsy" 
                    ? `Etsy: ${(feeConfig?.payment_processing_fee_percent || 3).toFixed(1)}% + $${(feeConfig?.payment_processing_fee_fixed || 0.25).toFixed(2)}`
                    : inputs.payment_method === "paypal"
                    ? `PayPal: ${(feeConfig?.paypal_fee_percent || 3.49).toFixed(2)}% + $${(feeConfig?.paypal_fee_fixed || 0.49).toFixed(2)}`
                    : inputs.payment_method === "square"
                    ? `Square: ${(feeConfig?.square_fee_percent || 2.9).toFixed(1)}% + $${(feeConfig?.square_fee_fixed || 0.30).toFixed(2)}`
                    : inputs.payment_method === "venmo_business"
                    ? `Venmo Business: ${(feeConfig?.venmo_business_fee_percent || 1.9).toFixed(1)}% + $${(feeConfig?.venmo_business_fee_fixed || 0.10).toFixed(2)}`
                    : "No fee"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary + Breakdown (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KPICard
              label="Net Profit"
              value={formatCurrency(results.profit, true)}
              color={results.profit >= 0 ? "text-emerald-600" : "text-rose-600"}
              bgColor={results.profit >= 0 ? "bg-emerald-50" : "bg-rose-50"}
            />
            <KPICard
              label="Profit Margin"
              value={formatPercent(results.profit_margin)}
              color={results.profit_margin >= 0 ? "text-emerald-600" : "text-rose-600"}
            />
            <KPICard
              label="Total Fees"
              value={formatCurrency(results.total_fees)}
              color="text-rose-600"
            />
            <KPICard
              label="Total Costs"
              value={formatCurrency(totalCosts)}
              color="text-amber-600"
            />
            <KPICard
              label="Total Revenue"
              value={formatCurrency(results.gross_revenue)}
              color="text-blue-600"
            />
            <KPICard
              label="Effective Fee Rate"
              value={formatPercent(results.effective_fee_rate)}
              color="text-stone-600"
            />
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry) => `${value}: ${formatCurrency(entry.payload.value)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Revenue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <BreakdownRow label="Sales" amount={inputs.sales_price} indent />
                <BreakdownRow label="Shipping Price" amount={inputs.shipping_charged} indent />
                <BreakdownRow 
                  label={`Discounts${inputs.discounts_type === "percent" ? ` (${inputs.discounts}%)` : ""}`}
                  amount={inputs.discounts_type === "percent" 
                    ? -((inputs.sales_price + inputs.shipping_charged) * inputs.discounts / 100) 
                    : -inputs.discounts
                  }
                  indent 
                />
                <div className="border-t border-stone-200 mt-2 pt-2">
                  <BreakdownRow label="Total Revenue" amount={results.gross_revenue} bold />
                </div>
              </CardContent>
            </Card>

            {/* Fees Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <BreakdownRow label="Listing Fee" amount={results.listing_fee} indent />
                <BreakdownRow label="Transaction Fee" amount={results.transaction_fee} indent />
                <BreakdownRow label="Payment Processing" amount={results.processing_fee} indent />
                {results.advertising_cost > 0 && (
                  <BreakdownRow label="Advertising" amount={results.advertising_cost} indent />
                )}
                {results.share_save_fee > 0 && (
                  <BreakdownRow label="Share & Save Credit" amount={-results.share_save_fee} indent />
                )}
                <div className="border-t border-stone-200 mt-2 pt-2">
                  <BreakdownRow label="Total Fees" amount={results.total_fees} bold />
                </div>
              </CardContent>
            </Card>

            {/* Costs Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Costs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <BreakdownRow label="Materials & Supplies" amount={inputs.cost_of_goods} indent />
                <BreakdownRow label="Total Labor Cost" amount={laborCost} indent />
                <div className="border-t border-stone-200 mt-1 pt-1">
                  <BreakdownRow label="Cost of Goods Sold" amount={totalCogs} bold />
                </div>
                <BreakdownRow label="Shipping Cost" amount={inputs.shipping_cost} indent />
                <BreakdownRow label="Overhead" amount={inputs.overhead_cost} indent />
                <div className="border-t border-stone-200 mt-2 pt-2">
                  <BreakdownRow label="Total Costs" amount={totalCosts} bold />
                </div>
              </CardContent>
            </Card>

            {/* Totals Section */}
            <Card className={results.profit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <BreakdownRow label="Total Revenue" amount={results.gross_revenue} indent />
                <BreakdownRow label="Total Fees + Cost" amount={results.total_fees + totalCosts} indent />
                <div className="border-t border-stone-300 mt-2 pt-2">
                  <BreakdownRow label="Net Profit" amount={results.profit} bold />
                  <div className="flex justify-between items-center py-2 font-semibold">
                    <span className="text-sm text-stone-900">Net Profit Margin</span>
                    <span className={`text-sm font-bold ${results.profit_margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatPercent(results.profit_margin)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warnings */}
          {results.profit < 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-800">
              <strong>⚠️ Warning:</strong> You're losing money on this item. Consider raising your price or reducing costs.
            </div>
          )}
          {results.profit >= 0 && results.profit_margin != null && results.profit_margin < 20 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <strong>⚠️ Low Margin:</strong> Your profit margin is below 20%. Consider optimizing your pricing or costs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}