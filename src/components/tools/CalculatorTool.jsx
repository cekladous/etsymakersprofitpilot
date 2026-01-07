import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator as CalcIcon, DollarSign, TrendingUp, Percent, ArrowRight, ExternalLink, Info } from "lucide-react";
import { calculateProfit, formatCurrency, formatPercent } from "@/components/shared/profitCalculator";
import { format } from "date-fns";

export default function CalculatorTool() {
  const [inputs, setInputs] = useState({
    sales_price: 25.00,
    shipping_charged: 5.00,
    discounts: 0,
    refunds: 0,
    sales_tax: 0,
    cost_of_goods: 8.00,
    shipping_cost: 0,
  });

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
      [field]: parseFloat(value) || 0,
    }));
  };

  const ResultCard = ({ label, value, color = "text-stone-900", icon: Icon }) => (
    <div className="p-4 bg-stone-50 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4 text-stone-400" />}
        <p className="text-sm text-stone-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );

  const FeeBreakdownRow = ({ label, amount, highlight = false }) => (
    <div className={`flex justify-between items-center py-2 ${highlight ? "border-t-2 border-stone-300 pt-3 mt-2" : "border-t border-stone-100"}`}>
      <span className={`${highlight ? "font-semibold text-stone-900" : "text-stone-600"}`}>
        {label}
      </span>
      <span className={`${highlight ? "font-bold text-stone-900 text-lg" : "font-medium text-stone-700"}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Fee Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2 flex-1">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-900">Current Etsy Fee Rates ({feeConfig?.fee_country || 'US'})</p>
              <div className="text-blue-800 text-sm space-y-0.5">
                <p>• Listing Fee: ${(feeConfig?.etsy_listing_fee || 0.20).toFixed(2)} per item</p>
                <p>• Transaction Fee: {(feeConfig?.etsy_transaction_fee_percent || 6.5).toFixed(1)}% of item price + shipping</p>
                <p>• Payment Processing: {(feeConfig?.payment_processing_fee_percent || 3.0).toFixed(1)}% + ${(feeConfig?.payment_processing_fee_fixed || 0.25).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <a
              href={feeSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
            >
              <ExternalLink className="w-3 h-3" />
              View Etsy Fee Source
            </a>
            {feesLastVerified && (
              <div className="text-xs text-blue-700 mt-1">
                Last verified: {format(new Date(feesLastVerified), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Inputs */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Revenue Inputs</CardTitle>
                  <CardDescription>What you charge the customer</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Item Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.sales_price}
                  onChange={(e) => handleInputChange("sales_price", e.target.value)}
                  className="text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label>Shipping Charged</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.shipping_charged}
                  onChange={(e) => handleInputChange("shipping_charged", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discounts</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inputs.discounts}
                    onChange={(e) => handleInputChange("discounts", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Refunds</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inputs.refunds}
                    onChange={(e) => handleInputChange("refunds", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sales Tax (excluded from revenue)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.sales_tax}
                  onChange={(e) => handleInputChange("sales_tax", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <CalcIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle>Cost Inputs</CardTitle>
                  <CardDescription>Your production costs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cost of Goods (materials + packaging)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.cost_of_goods}
                  onChange={(e) => handleInputChange("cost_of_goods", e.target.value)}
                  className="text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Shipping Cost (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inputs.shipping_cost}
                  onChange={(e) => handleInputChange("shipping_cost", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <ResultCard
              label="Gross Revenue"
              value={formatCurrency(results.gross_revenue)}
              color="text-blue-600"
              icon={DollarSign}
            />
            <ResultCard
              label="Total Fees"
              value={formatCurrency(results.total_fees)}
              color="text-rose-600"
              icon={ArrowRight}
            />
          </div>

          {/* Fee Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Fee Breakdown</CardTitle>
              <CardDescription>Etsy marketplace and payment processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <FeeBreakdownRow
                  label={`Listing Fee (${formatCurrency(feeConfig.etsy_listing_fee || 0.20)} per listing)`}
                  amount={results.listing_fee}
                />
                <FeeBreakdownRow
                  label={`Transaction Fee (${(feeConfig.etsy_transaction_fee_percent || 6.5).toFixed(1)}% of price + shipping)`}
                  amount={results.transaction_fee}
                />
                <FeeBreakdownRow
                  label={`Payment Processing (${(feeConfig.payment_processing_fee_percent || 3).toFixed(1)}% + ${formatCurrency(feeConfig.payment_processing_fee_fixed || 0.25)})`}
                  amount={results.processing_fee}
                />
                <FeeBreakdownRow
                  label="Total Marketplace Fees"
                  amount={results.total_fees}
                  highlight
                />
                <FeeBreakdownRow
                  label="Net Revenue (after fees)"
                  amount={results.net_revenue}
                />
                <FeeBreakdownRow
                  label="Cost of Goods"
                  amount={results.cost_of_goods}
                />
                {inputs.shipping_cost > 0 && (
                  <FeeBreakdownRow
                    label="Shipping Cost"
                    amount={inputs.shipping_cost}
                  />
                )}
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-lg text-sm text-stone-600">
                <p className="flex justify-between">
                  <span>Effective Fee Rate:</span>
                  <span className="font-semibold">{formatPercent(results.effective_fee_rate)}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Profit Summary */}
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <TrendingUp className="w-5 h-5" />
                Profit Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Gross Revenue</span>
                  <span className="font-medium">{formatCurrency(results.gross_revenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">− Marketplace Fees</span>
                  <span className="font-medium text-rose-600">-{formatCurrency(results.total_fees)}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-emerald-200 pb-2">
                  <span className="text-stone-600">Net Revenue</span>
                  <span className="font-medium">{formatCurrency(results.net_revenue)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-stone-600">− Cost of Goods</span>
                  <span className="font-medium text-rose-600">-{formatCurrency(results.cost_of_goods)}</span>
                </div>
                {inputs.shipping_cost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">− Shipping Cost</span>
                    <span className="font-medium text-rose-600">-{formatCurrency(inputs.shipping_cost)}</span>
                  </div>
                )}
              </div>

              <div className="border-t-2 border-emerald-300 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-emerald-900">Net Profit</span>
                  <span className={`text-3xl font-bold ${results.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(results.profit, true)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-emerald-700">Profit Margin</span>
                  <span className={`text-xl font-bold flex items-center gap-1 ${results.profit_margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    <Percent className="w-4 h-4" />
                    {formatPercent(results.profit_margin)}
                  </span>
                </div>
              </div>

              {results.profit_margin < 20 && results.profit_margin >= 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  ⚠️ Low margin. Consider raising price or reducing costs.
                </div>
              )}
              {results.profit < 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">
                  ⚠️ Negative profit. You're losing money on this item.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}