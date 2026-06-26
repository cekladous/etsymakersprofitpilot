import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, Target, TrendingUp, DollarSign, Package, Info, AlertCircle } from "lucide-react";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);
};

const formatNumber = (num) => {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(num || 0);
};

const FREQUENCY_TO_MONTHLY = {
  Weekly: 52 / 12,
  Monthly: 1,
  Quarterly: 4 / 12,
  Annually: 1 / 12,
};

export default function BreakevenCalculatorTool() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState({
    retail_price: 0,
    material_cost: 0,
    shipping_cost: 0,
    platform_fee_pct: 6.5,
    processing_fee_pct: 3,
    flat_fee: 0.25,
    fixed_monthly_expenses: 0,
    target_profit: 0,
  });
  const [useAutoExpenses, setUseAutoExpenses] = useState(true);

  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ["recurring-expenses-breakeven", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BusinessExpense.filter({ owner_user_id: user.id, is_recurring: true }, "-date", 200),
  });

  const autoMonthlyExpenses = useMemo(() => {
    return recurringExpenses.reduce((sum, e) => {
      const multiplier = FREQUENCY_TO_MONTHLY[e.recurring_frequency] || 1;
      return sum + (e.amount || 0) * multiplier;
    }, 0);
  }, [recurringExpenses]);

  const fixedMonthlyExpenses = useAutoExpenses ? autoMonthlyExpenses : (inputs.fixed_monthly_expenses || 0);

  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleReset = () => {
    setInputs({
      retail_price: 0,
      material_cost: 0,
      shipping_cost: 0,
      platform_fee_pct: 6.5,
      processing_fee_pct: 3,
      flat_fee: 0.25,
      fixed_monthly_expenses: 0,
      target_profit: 0,
    });
    setUseAutoExpenses(true);
  };

  const retail = inputs.retail_price || 0;
  const platformFee = retail * (inputs.platform_fee_pct / 100);
  const processingFee = retail * (inputs.processing_fee_pct / 100);
  const totalVariableCost = inputs.material_cost + inputs.shipping_cost + platformFee + processingFee + inputs.flat_fee;
  const contributionMargin = retail - totalVariableCost;

  const breakevenUnits = contributionMargin > 0 ? fixedMonthlyExpenses / contributionMargin : 0;
  const breakevenRevenue = breakevenUnits * retail;
  const unitsForTarget = contributionMargin > 0 ? (fixedMonthlyExpenses + inputs.target_profit) / contributionMargin : 0;
  const revenueForTarget = unitsForTarget * retail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Breakeven & Profit Goal Calculator</h2>
          <p className="text-stone-500 text-sm mt-1">Find out how many items you need to sell to cover costs and hit your profit goal</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Per-Item Economics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Average Retail Price (per item) *</Label>
                <Input type="number" step="0.01" min="0" value={inputs.retail_price} onChange={(e) => handleInputChange("retail_price", e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Material Cost (per item)</Label>
                <Input type="number" step="0.01" min="0" value={inputs.material_cost} onChange={(e) => handleInputChange("material_cost", e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Shipping Cost to Customer (per item)</Label>
                <Input type="number" step="0.01" min="0" value={inputs.shipping_cost} onChange={(e) => handleInputChange("shipping_cost", e.target.value)} className="h-11" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Platform & Processing Fees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Platform Fee % (Etsy transaction)</Label>
                <Input type="number" step="0.01" min="0" value={inputs.platform_fee_pct} onChange={(e) => handleInputChange("platform_fee_pct", e.target.value)} className="h-11" />
                <p className="text-xs text-stone-500">Default 6.5% for Etsy</p>
              </div>
              <div className="space-y-2">
                <Label>Processing Fee %</Label>
                <Input type="number" step="0.01" min="0" value={inputs.processing_fee_pct} onChange={(e) => handleInputChange("processing_fee_pct", e.target.value)} className="h-11" />
                <p className="text-xs text-stone-500">Default 3%</p>
              </div>
              <div className="space-y-2">
                <Label>Flat Fee per transaction</Label>
                <Input type="number" step="0.01" min="0" value={inputs.flat_fee} onChange={(e) => handleInputChange("flat_fee", e.target.value)} className="h-11" />
                <p className="text-xs text-stone-500">Default $0.25</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Fixed Costs & Goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fixed Monthly Expenses</Label>
                {recurringExpenses.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      type="button"
                      variant={useAutoExpenses ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseAutoExpenses(true)}
                      className={useAutoExpenses ? "bg-emerald-600" : ""}
                    >
                      Auto: {formatCurrency(autoMonthlyExpenses)}
                    </Button>
                    <Button
                      type="button"
                      variant={!useAutoExpenses ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseAutoExpenses(false)}
                    >
                      Manual
                    </Button>
                  </div>
                )}
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={useAutoExpenses ? autoMonthlyExpenses.toFixed(2) : inputs.fixed_monthly_expenses}
                  onChange={(e) => {
                    setUseAutoExpenses(false);
                    handleInputChange("fixed_monthly_expenses", e.target.value);
                  }}
                  className="h-11"
                  disabled={useAutoExpenses}
                />
                <p className="text-xs text-stone-500">
                  {useAutoExpenses && recurringExpenses.length > 0
                    ? `Auto-pulled from ${recurringExpenses.length} recurring expense(s)`
                    : "Recurring expenses converted to monthly equivalent"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Target Monthly Profit Goal ($)</Label>
                <Input type="number" step="0.01" min="0" value={inputs.target_profit} onChange={(e) => handleInputChange("target_profit", e.target.value)} className="h-11" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-7 space-y-6">
          {contributionMargin <= 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Warning:</strong> Your contribution margin is {formatCurrency(contributionMargin)} per item. You're losing money on every sale. Increase your price or reduce costs before calculating breakeven.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2 bg-amber-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-amber-600" />
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Variable Cost / Item</p>
                </div>
                <p className="text-2xl font-bold text-amber-600 mb-1">{formatCurrency(totalVariableCost)}</p>
                <p className="text-xs text-stone-500">Material + shipping + fees per item</p>
              </CardContent>
            </Card>
            <Card className={`border-2 ${contributionMargin > 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={`w-5 h-5 ${contributionMargin > 0 ? "text-emerald-600" : "text-rose-600"}`} />
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Contribution Margin / Item</p>
                </div>
                <p className={`text-2xl font-bold mb-1 ${contributionMargin > 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(contributionMargin)}</p>
                <p className="text-xs text-stone-500">Retail price minus variable costs</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Breakeven Point
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Breakeven Units / Month</p>
                  <p className="text-3xl font-bold text-blue-700">{formatNumber(Math.ceil(breakevenUnits))}</p>
                  <p className="text-xs text-stone-600 mt-1">
                    You need to sell <strong>{formatNumber(Math.ceil(breakevenUnits))}</strong> items just to cover your costs
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Breakeven Revenue / Month</p>
                  <p className="text-3xl font-bold text-blue-700">{formatCurrency(breakevenRevenue)}</p>
                  <p className="text-xs text-stone-600 mt-1">
                    Revenue needed to break even: {formatCurrency(breakevenRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-emerald-200 bg-emerald-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Target Profit Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Units to Hit Target</p>
                  <p className="text-3xl font-bold text-emerald-700">{formatNumber(Math.ceil(unitsForTarget))}</p>
                  <p className="text-xs text-stone-600 mt-1">
                    Sell <strong>{formatNumber(Math.ceil(unitsForTarget))}</strong> items to earn {formatCurrency(inputs.target_profit)} in profit
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Revenue to Hit Target</p>
                  <p className="text-3xl font-bold text-emerald-700">{formatCurrency(revenueForTarget)}</p>
                  <p className="text-xs text-stone-600 mt-1">
                    Revenue needed: {formatCurrency(revenueForTarget)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-stone-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-stone-600 space-y-1">
                <p><strong>How it works:</strong> Contribution Margin = Retail Price − (Material + Shipping + Platform Fee + Processing Fee + Flat Fee).</p>
                <p>Breakeven Units = Fixed Monthly Expenses ÷ Contribution Margin per item.</p>
                <p>Units for Target Profit = (Fixed Monthly Expenses + Profit Goal) ÷ Contribution Margin per item.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}