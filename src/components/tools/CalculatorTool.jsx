import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
import { Calculator as CalcIcon, DollarSign, TrendingUp, Percent, ArrowRight, ExternalLink, Info, RotateCcw, Save } from "lucide-react";
import { calculateProfit, formatCurrency, formatPercent } from "@/components/shared/profitCalculator";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const defaultInputs = {
  sales_price: 25.00,
  shipping_charged: 5.00,
  discounts: 0,
  refunds: 0,
  sales_tax: 0,
  cost_of_goods: 8.00,
  shipping_cost: 0,
  advertising_type: "none",
  advertising_value: 0,
  advertising_value_type: "percent",
  offsite_ads_percent: 15,
  payment_method: "etsy",
};

export default function CalculatorTool() {
  const [inputs, setInputs] = useState(defaultInputs);
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });

  const feeConfig = settings[0] || {};
  const results = calculateProfit(inputs, feeConfig);

  const feeSourceUrl = settings[0]?.fee_source_url || "https://help.etsy.com/hc/en-us/articles/360035902374";
  const feesLastVerified = settings[0]?.fees_last_verified_date;

  const handleInputChange = (field, value) => {
    setInputs(prev => ({
      ...prev,
      [field]: typeof value === 'string' && isNaN(parseFloat(value)) ? value : (parseFloat(value) || 0),
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

  // Chart data
  const totalCosts = results.cost_of_goods + (inputs.shipping_cost || 0);
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
        </div>
      </div>

      {/* Fee Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2 flex-1">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              <span className="font-semibold">Fee Rates ({feeConfig?.fee_country || 'US'}):</span> Listing ${(feeConfig?.etsy_listing_fee || 0.20).toFixed(2)} • Transaction {(feeConfig?.etsy_transaction_fee_percent || 6.5).toFixed(1)}% • Processing {(feeConfig?.payment_processing_fee_percent || 3.0).toFixed(1)}% + ${(feeConfig?.payment_processing_fee_fixed || 0.25).toFixed(2)}
            </div>
          </div>
          <a
            href={feeSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
          >
            <ExternalLink className="w-3 h-3" />
            Source
          </a>
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
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.discounts}
                  onChange={(e) => handleInputChange("discounts", e.target.value)}
                  className="h-11"
                />
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
                <Label className="text-sm font-medium">Cost of Goods Sold</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.cost_of_goods}
                  onChange={(e) => handleInputChange("cost_of_goods", e.target.value)}
                  className="h-11"
                />
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
                    <SelectItem value="offsite_ads">Offsite Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inputs.advertising_type === "etsy_ads" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Average Cost of Sale</Label>
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
                  </div>
                </>
              )}

              {inputs.advertising_type === "offsite_ads" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Offsite Ads %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={inputs.offsite_ads_percent}
                    onChange={(e) => handleInputChange("offsite_ads_percent", e.target.value)}
                    className="h-11"
                  />
                </div>
              )}
            </CardContent>
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
                  </SelectContent>
                </Select>
                <p className="text-xs text-stone-500">
                  {inputs.payment_method === "etsy" 
                    ? `Etsy: ${(feeConfig?.payment_processing_fee_percent || 3).toFixed(1)}% + $${(feeConfig?.payment_processing_fee_fixed || 0.25).toFixed(2)}`
                    : inputs.payment_method === "paypal"
                    ? `PayPal: ${(feeConfig?.paypal_fee_percent || 3.49).toFixed(2)}% + $${(feeConfig?.paypal_fee_fixed || 0.49).toFixed(2)}`
                    : `Square: ${(feeConfig?.square_fee_percent || 2.9).toFixed(1)}% + $${(feeConfig?.square_fee_fixed || 0.30).toFixed(2)}`
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
              label="CoGS + Shipping"
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
                <BreakdownRow label="Discounts" amount={-inputs.discounts} indent />
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
                <BreakdownRow label="Cost of Goods Sold" amount={results.cost_of_goods} indent />
                <BreakdownRow label="Shipping Cost" amount={inputs.shipping_cost} indent />
                <div className="border-t border-stone-200 mt-2 pt-2">
                  <BreakdownRow label="Total CoGS + Shipping" amount={totalCosts} bold />
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
                  <BreakdownRow label="Net Profit Margin" amount={0} bold />
                  <div className="flex justify-end">
                    <span className={`text-lg font-bold ${results.profit_margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
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
          {results.profit >= 0 && results.profit_margin < 20 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <strong>⚠️ Low Margin:</strong> Your profit margin is below 20%. Consider optimizing your pricing or costs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}