import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download } from "lucide-react";
import DonutChart from "@/components/reports/DonutChart";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

export default function ReportsTab({ financialData, sharedData, dateRange, periodLabel }) {
  const monthlyData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return [];
    const result = [];
    const cursor = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1);
    while (cursor <= dateRange.end) {
      const mStart = startOfMonth(cursor);
      const mEnd = endOfMonth(cursor);
      const fd = aggregateFinancials(sharedData, { start: mStart, end: mEnd });
      const hasData = fd.totalRevenue > 0 || fd.totalExpenses > 0;
      result.push({
        labelFull: format(mStart, "MMMM"),
        etsySales: fd.revenue.netEtsySales || 0,
        customSales: fd.revenue.customRevenueTotal || 0,
        totalRevenue: fd.totalRevenue || 0,
        totalExpenses: fd.totalExpenses || 0,
        netProfit: fd.netProfit || 0,
        profitMargin: fd.profitMargin || 0,
        hasData,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }, [sharedData, dateRange]);

  const expenseChartData = useMemo(() => {
    if (!financialData) return [];
    const items = [
      { name: "Materials & Supplies", value: financialData.productExpenses?.materialsSupplies || 0, color: "#3b82f6" },
      { name: "Tools & Equipment", value: financialData.productExpenses?.toolsEquipment || 0, color: "#f59e0b" },
      { name: "Listing Fees", value: financialData.sellingExpenses?.etsyListingFees || 0, color: "#fb923c" },
      { name: "Transaction Fees", value: financialData.sellingExpenses?.etsyTransactionFees || 0, color: "#f97316" },
      { name: "Processing Fees", value: financialData.sellingExpenses?.etsyProcessingFees || 0, color: "#ea580c" },
      { name: "Other Fees", value: financialData.sellingExpenses?.otherFees || 0, color: "#c2410c" },
      { name: "Etsy Ads", value: financialData.sellingExpenses?.etsyAds || 0, color: "#fbbf24" },
      { name: "Offsite Ads", value: financialData.sellingExpenses?.etsyOffsiteAds || 0, color: "#d97706" },
      { name: "Etsy Plus Subscription", value: financialData.sellingExpenses?.etsyPlusSubscription || 0, color: "#b45309" },
      { name: "Shipping Labels", value: financialData.sellingExpenses?.etsyShipping || 0, color: "#eab308" },
      { name: "Other Postage", value: financialData.sellingExpenses?.otherPostage || 0, color: "#facc15" },
      { name: "Share & Save Credits", value: Math.abs(financialData.sellingExpenses?.shareSaveRefunds || 0), color: "#34d399" },
      { name: "Fee Credits", value: financialData.sellingExpenses?.feeCredits || 0, color: "#6ee7b7" },
      { name: "Advertising & Marketing", value: financialData.businessExpenses?.advertisingMarketing || 0, color: "#ec4899" },
      { name: "Office Expenses", value: financialData.businessExpenses?.officeExpenses || 0, color: "#10b981" },
      { name: "Gas / Mileage", value: financialData.businessExpenses?.gasMileage || 0, color: "#06b6d4" },
      { name: "Utilities / Cell Phone", value: financialData.businessExpenses?.utilitiesCellPhone || 0, color: "#6366f1" },
      { name: "Software / Subscriptions", value: financialData.businessExpenses?.softwareSubscriptions || 0, color: "#8b5cf6" },
      { name: "Professional Services", value: financialData.businessExpenses?.professionalServices || 0, color: "#a855f7" },
      { name: "Payment Processing Fees", value: financialData.businessExpenses?.paymentProcessingFees || 0, color: "#f43f5e" },
      { name: "Insurance", value: financialData.businessExpenses?.insurance || 0, color: "#84cc16" },
      { name: "Rent / Lease", value: financialData.businessExpenses?.rent || 0, color: "#d946ef" },
      { name: "Shipping & Postage", value: financialData.businessExpenses?.shippingPostage || 0, color: "#ca8a04" },
      { name: "Other", value: financialData.businessExpenses?.other || 0, color: "#78716c" },
      { name: "Miscellaneous", value: financialData.businessExpenses?.miscellaneous || 0, color: "#a8a29e" },
    ];
    return items.filter(i => i.value > 0.01);
  }, [financialData]);

  const salesChartData = useMemo(() => {
    if (!financialData?.revenue?.bySource) return [];
    const colors = {
      "Etsy": "#059669",
      "In-Person (Square)": "#0d9488",
      "Squarespace": "#2563eb",
      "Square": "#4f46e5",
      "In-Person/Cash": "#7c3aed",
      "Website": "#db2777",
      "Instagram": "#e11d48",
      "Other": "#78716c",
    };
    return Object.entries(financialData.revenue.bySource)
      .filter(([_, value]) => value > 0.01)
      .map(([name, value]) => ({ name, value, color: colors[name] || "#78716c" }));
  }, [financialData]);

  const exportCSV = () => {
    const rows = monthlyData.filter(m => m.hasData);
    const csv = [
      ["Month", "Etsy Sales", "Custom Sales", "Total Revenue", "Total Expenses", "Net Profit", "Profit Margin %"],
      ...rows.map(m => [
        m.labelFull, m.etsySales.toFixed(2), m.customSales.toFixed(2),
        m.totalRevenue.toFixed(2), m.totalExpenses.toFixed(2), m.netProfit.toFixed(2),
        m.profitMargin ? m.profitMargin.toFixed(1) : "0",
      ]),
      ["TOTAL",
        (financialData.revenue?.netEtsySales || 0).toFixed(2),
        (financialData.revenue?.customRevenueTotal || 0).toFixed(2),
        (financialData.totalRevenue || 0).toFixed(2),
        (financialData.totalExpenses || 0).toFixed(2),
        (financialData.netProfit || 0).toFixed(2),
        financialData.profitMargin ? financialData.profitMargin.toFixed(1) : "0"],
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${(periodLabel || "summary").replace(/[^\w-]/g, "_")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Donut Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseChartData.length > 0 ? (
              <DonutChart data={expenseChartData} totalLabel="Total Expenses" />
            ) : (
              <p className="text-sm text-stone-500 text-center py-8">No expense data for this period</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {salesChartData.length > 0 ? (
              <DonutChart data={salesChartData} totalLabel="Total Sales" />
            ) : (
              <p className="text-sm text-stone-500 text-center py-8">No sales data for this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-3 px-2 font-semibold text-stone-700">Month</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Etsy Sales</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Custom Sales</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Total Revenue</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Total Expenses</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Net Profit</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Margin</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m, idx) => (
                  <tr key={idx} className={`border-b border-stone-100 ${m.hasData ? "" : "opacity-40"}`}>
                    <td className="py-3 px-2 font-medium text-stone-900">{m.labelFull}</td>
                    <td className="text-right py-3 px-2 text-emerald-600">{m.hasData ? formatCurrency(m.etsySales) : "—"}</td>
                    <td className="text-right py-3 px-2 text-blue-600">{m.hasData ? formatCurrency(m.customSales) : "—"}</td>
                    <td className="text-right py-3 px-2 font-semibold text-stone-900">{m.hasData ? formatCurrency(m.totalRevenue) : "—"}</td>
                    <td className="text-right py-3 px-2 font-medium text-stone-900">{m.hasData ? formatCurrency(m.totalExpenses) : "—"}</td>
                    <td className={`text-right py-3 px-2 font-semibold ${m.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{m.hasData ? formatCurrency(m.netProfit) : "—"}</td>
                    <td className="text-right py-3 px-2 text-stone-500">{m.hasData && m.profitMargin ? `${m.profitMargin.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-stone-300 bg-stone-50 font-bold">
                  <td className="py-3 px-2 text-stone-900">TOTAL</td>
                  <td className="text-right py-3 px-2 text-emerald-600">{formatCurrency(financialData.revenue?.netEtsySales)}</td>
                  <td className="text-right py-3 px-2 text-blue-600">{formatCurrency(financialData.revenue?.customRevenueTotal)}</td>
                  <td className="text-right py-3 px-2 text-stone-900">{formatCurrency(financialData.totalRevenue)}</td>
                  <td className="text-right py-3 px-2 text-stone-900">{formatCurrency(financialData.totalExpenses)}</td>
                  <td className={`text-right py-3 px-2 ${(financialData.netProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(financialData.netProfit)}</td>
                  <td className="text-right py-3 px-2 text-stone-700">{financialData.profitMargin ? financialData.profitMargin.toFixed(1) : "0"}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}