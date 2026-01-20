import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startOfMonth, endOfMonth, format, eachMonthOfInterval } from "date-fns";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
import { createPageUrl } from "@/utils";
import { getBusinessExpenseCategories, getFeeCategories, getSchemaNameForKey } from "@/components/shared/categoryMappings";

export default function ActualsSpendingMatrix({ 
  dateRange, 
  viewMode,
  etsyOrders,
  customSales,
  businessExpenses,
  transfers,
  materialPurchases,
  etsyLedgerEntries,
  orderFees,
  expenses
}) {
  const [includeFees, setIncludeFees] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Generate month columns
  const months = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return [];
    
    if (viewMode === "month") {
      return [dateRange];
    } else if (viewMode === "quarter" || viewMode === "year") {
      return eachMonthOfInterval({ start: dateRange.start, end: dateRange.end })
        .map(date => ({
          start: startOfMonth(date),
          end: endOfMonth(date),
        }));
    }
    return [];
  }, [dateRange, viewMode]);

  // Calculate spending for each month
  const monthlyData = useMemo(() => {
    return months.map(monthRange => 
      aggregateFinancials({
        etsyOrders,
        customSales,
        businessExpenses,
        transfers,
        materialPurchases,
        etsyLedgerEntries,
        orderFees,
        expenses,
      }, monthRange)
    );
  }, [months, etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, expenses]);

  // Load categories dynamically from schema (single source of truth)
  const expenseCategories = useMemo(() => getBusinessExpenseCategories(), []);
  const feeCategories = useMemo(() => getFeeCategories(), []);

  const allCategories = includeFees 
    ? [...feeCategories, ...expenseCategories]
    : expenseCategories;

  const getCategoryValue = (data, category) => {
    if (category.section === "product") {
      return data.productExpenses?.[category.key] || 0;
    } else if (category.section === "business") {
      return data.businessExpenses?.[category.key] || 0;
    } else if (category.section === "fees") {
      return data.sellingExpenses?.[category.key] || 0;
    }
    return 0;
  };

  const handleCellClick = (category, monthIndex) => {
    const monthRange = months[monthIndex];
    const categoryName = category.schemaName;
    
    // Navigate to Expenses page with filters (spreadsheet-style drill-down)
    const url = createPageUrl("Expenses") + 
      `?startDate=${format(monthRange.start, 'yyyy-MM-dd')}` +
      `&endDate=${format(monthRange.end, 'yyyy-MM-dd')}` +
      `&range=custom` +
      `&source=actuals` +
      `&category=${categoryName}`;
    
    window.location.href = url;
  };

  // Calculate grand total for validation
  const grandTotal = useMemo(() => {
    return monthlyData.reduce((sum, data) => {
      const monthTotal = allCategories.reduce((catSum, cat) => 
        catSum + getCategoryValue(data, cat), 0);
      return sum + monthTotal;
    }, 0);
  }, [monthlyData, allCategories]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Actual Spending Matrix</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-stone-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs font-semibold mb-1">Actual Spending Matrix</p>
                    <p className="text-xs mb-2">Shows all business expenses by category and period. Click any cell to drill into transaction details.</p>
                    <p className="text-xs text-stone-500">Note: Totals here must exactly match Dashboard Total Expenses and Net Profit Statement totals for the same period.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="include-fees" 
                checked={includeFees}
                onCheckedChange={setIncludeFees}
              />
              <Label htmlFor="include-fees" className="text-sm cursor-pointer">
                Include Etsy Fees
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-stone-300">
                  <th className="text-left py-3 px-4 font-semibold bg-stone-50 sticky left-0 z-10">Category</th>
                  {months.map((month, idx) => (
                    <th key={idx} className="text-right py-3 px-4 font-semibold bg-stone-50 min-w-[100px]">
                      {format(month.start, "MMM yyyy")}
                    </th>
                  ))}
                  <th className="text-right py-3 px-4 font-semibold bg-stone-100 min-w-[100px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {allCategories.map((category, catIdx) => {
                  const categoryTotal = monthlyData.reduce((sum, data) => 
                    sum + getCategoryValue(data, category), 0);
                  
                  return (
                    <tr key={catIdx} className="border-b border-stone-200 hover:bg-stone-50">
                      <td className="py-2 px-4 font-medium sticky left-0 bg-white z-10">
                        {category.label}
                      </td>
                      {monthlyData.map((data, monthIdx) => {
                        const value = getCategoryValue(data, category);
                        return (
                          <td 
                            key={monthIdx} 
                            className={`text-right py-2 px-4 ${value > 0 ? 'cursor-pointer hover:bg-emerald-50' : 'text-stone-400'}`}
                            onClick={() => value > 0 && handleCellClick(category, monthIdx)}
                          >
                            {formatCurrency(value)}
                          </td>
                        );
                      })}
                      <td className="text-right py-2 px-4 font-semibold bg-stone-50">
                        {formatCurrency(categoryTotal)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-stone-300 font-bold bg-stone-100">
                  <td className="py-3 px-4 sticky left-0 bg-stone-100 z-10">Total Spending</td>
                  {monthlyData.map((data, idx) => {
                    const monthTotal = allCategories.reduce((sum, cat) => 
                      sum + getCategoryValue(data, cat), 0);
                    return (
                      <td key={idx} className="text-right py-3 px-4">
                        {formatCurrency(monthTotal)}
                      </td>
                    );
                  })}
                  <td className="text-right py-3 px-4 bg-stone-200">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>


    </>
  );
}