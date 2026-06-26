import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, ArrowRight } from "lucide-react";
import { calculateProfit, formatCurrency, formatPercent } from "@/components/shared/profitCalculator";

export default function ProfitCalculatorWidget() {
  const [price, setPrice] = useState(0);
  const [cogs, setCogs] = useState(0);

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });

  const result = calculateProfit({
    sales_price: price,
    shipping_charged: 0,
    discounts: 0,
    refunds: 0,
    sales_tax: 0,
    cost_of_goods: cogs,
  }, settings[0]);

  return (
    <Card className="border-2 border-emerald-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Calculator className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Quick Profit Check</CardTitle>
              <CardDescription>See your profit before fees</CardDescription>
            </div>
          </div>
          <Link to={createPageUrl("Tools")}>
            <Button variant="ghost" size="sm">
              Full Calculator
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-stone-500">Price</label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-stone-500">Cost</label>
            <Input
              type="number"
              step="0.01"
              value={cogs}
              onChange={(e) => setCogs(parseFloat(e.target.value) || 0)}
              className="h-9"
            />
          </div>
        </div>

        <div className="bg-emerald-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-stone-600">Fees</span>
            <span className="font-medium text-rose-600">-{formatCurrency(result.total_fees)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
            <span className="font-semibold text-emerald-900">Your Profit</span>
            <div className="text-right">
              <p className={`text-2xl font-bold ${result.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(result.profit)}
              </p>
              <p className="text-xs text-emerald-700">
                {formatPercent(result.profit_margin)} margin
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}