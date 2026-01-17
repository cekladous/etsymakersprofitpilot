import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startOfMonth, endOfMonth, format, eachMonthOfInterval } from "date-fns";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
import LineItemDrillDown from "./LineItemDrillDown";

export default function ActualsSpendingMatrix({ 
  dateRange, 
  viewMode,
  etsyOrders,
  customSales,
  businessExpenses,
  transfers,
  materialPurchases,
  etsyLedgerEntries,
  orderFees
}) {
  const [includeFees, setIncludeFees] = useState(false);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState({ title: "", items: [] });

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
      }, monthRange)
    );
  }, [months, etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees]);

  // Define expense categories
  const expenseCategories = [
    { label: "Materials & Supplies", key: "materialsSupplies", section: "product" },
    { label: "Tools & Equipment", key: "toolsEquipment", section: "product" },
    { label: "Advertising & Marketing", key: "advertisingMarketing", section: "business" },
    { label: "Office Expenses", key: "officeExpenses", section: "business" },
    { label: "Professional Services", key: "professionalServices", section: "business" },
    { label: "Other", key: "other", section: "business" },
    { label: "Miscellaneous", key: "miscellaneous", section: "business" },
  ];

  const feeCategories = [
    { label: "Listing Fees", key: "etsyListingFees", section: "fees" },
    { label: "Transaction Fees", key: "etsyTransactionFees", section: "fees" },
    { label: "Processing Fees", key: "etsyProcessingFees", section: "fees" },
    { label: "Etsy Ads", key: "etsyAds", section: "fees" },
    { label: "Offsite Ads", key: "etsyOffsiteAds", section: "fees" },
    { label: "Shipping Labels", key: "etsyShipping", section: "fees" },
    { label: "Other Postage", key: "otherPostage", section: "fees" },
  ];

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
    const monthData = monthlyData[monthIndex];
    const categoryName = getCategoryNameMapping(category.key);
    
    let items = [];
    
    if (category.key === "materialsSupplies") {
      const purchases = (monthData._rawData?.materialPurchases || []).map(p => ({
        date: p.purchase_date,
        description: p.material_name,
        vendor: p.vendor,
        payment_source: p.payment_method,
        amount: p.total_cost,
      }));
      items.push(...purchases);
    }
    
    const expenses = (monthData._rawData?.businessExpenses || [])
      .filter(e => e.category_name === categoryName)
      .map(e => ({
        date: e.date,
        description: e.description,
        vendor: e.vendor,
        payment_source: e.payment_source,
        amount: e.amount,
      }));
    
    items.push(...expenses);
    
    const ledgerEntries = (monthData._rawData?.etsyLedgerEntries || [])
      .filter(e => e.matched_category === categoryName)
      .map(e => ({
        date: e.entry_date,
        description: `${e.title} - ${e.info}`,
        vendor: "Etsy",
        payment_source: "Etsy Payment Ledger",
        amount: Math.abs(e.net || 0),
      }));
    
    items.push(...ledgerEntries);
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const monthLabel = format(months[monthIndex].start, "MMMM yyyy");
    setDrillDownData({ title: `${category.label} - ${monthLabel}`, items });
    setDrillDownOpen(true);
  };

  const getCategoryNameMapping = (key) => {
    const mapping = {
      materialsSupplies: "materials_supplies",
      toolsEquipment: "tools_equipment",
      advertisingMarketing: "advertising_marketing",
      officeExpenses: "office_expenses",
      professionalServices: "professional_services",
      other: "other",
      miscellaneous: "miscellaneous_expenses",
      etsyListingFees: "etsy_listing_fees",
      etsyTransactionFees: "etsy_transaction_fees",
      etsyProcessingFees: "etsy_processing_fees",
      etsyAds: "etsy_ads",
      etsyOffsiteAds: "etsy_offsite_ads_fees",
      etsyShipping: "etsy_shipping",
      otherPostage: "other_postage_costs",
    };
    return mapping[key] || key;
  };

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
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">View spending by category and month. Click any cell to see details.</p>
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
                            {value > 0 ? formatCurrency(value) : "-"}
                          </td>
                        );
                      })}
                      <td className="text-right py-2 px-4 font-semibold bg-stone-50">
                        {categoryTotal > 0 ? formatCurrency(categoryTotal) : "-"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-stone-300 font-bold bg-stone-100">
                  <td className="py-3 px-4 sticky left-0 bg-stone-100 z-10">Total Spending</td>
                  {monthlyData.map((data, idx) => (
                    <td key={idx} className="text-right py-3 px-4">
                      {formatCurrency(data.totalExpenses)}
                    </td>
                  ))}
                  <td className="text-right py-3 px-4 bg-stone-200">
                    {formatCurrency(monthlyData.reduce((sum, d) => sum + d.totalExpenses, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <LineItemDrillDown
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownData.title}
        items={drillDownData.items}
      />
    </>
  );
}