import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/ui/PageHeader";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Download, Info } from "lucide-react";
import DonutChart from "@/components/reports/DonutChart";
import ProfitLossStatement from "@/components/reports/ProfitLossStatement";

export default function Reports() {
  const { user, loading } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: etsyOrders = [] } = useQuery({
    queryKey: ["etsy-orders-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyOrder.filter({ owner_user_id: user.id }, "-sale_date", 5000),
  });

  const { data: customSales = [] } = useQuery({
    queryKey: ["custom-sales-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.CustomSale.filter({ owner_user_id: user.id }, "-date", 5000),
  });

  const { data: businessExpenses = [] } = useQuery({
    queryKey: ["business-expenses-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BusinessExpense.filter({ owner_user_id: user.id }, "-date", 5000),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Expense.filter({ owner_user_id: user.id }, "-date", 5000),
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.OrderFee.filter({ owner_user_id: user.id }),
  });

  const { data: fees = [] } = useQuery({
    queryKey: ["fees-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Fee.filter({ owner_user_id: user.id }, "-transaction_date", 5000),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Transfer.filter({ owner_user_id: user.id }, "-date", 5000),
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialPurchase.filter({ owner_user_id: user.id }, "-purchase_date", 5000),
  });

  const { data: etsyLedgerEntries = [] } = useQuery({
    queryKey: ["etsy-ledger-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyLedgerEntry.filter({ owner_user_id: user.id }, "-entry_date", 10000),
  });

  const { data: etsyStatementLines = [] } = useQuery({
    queryKey: ["etsy-statement-lines-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementLine.filter({ owner_user_id: user.id }),
  });

  const { data: etsyStatementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports-reports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementImport.filter({ owner_user_id: user.id }),
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

  const sharedData = {
    etsyOrders, customSales, businessExpenses, transfers, materialPurchases,
    etsyLedgerEntries, orderFees, expenses, fees, etsyStatementLines, etsyStatementImports,
  };

  const monthlyData = useMemo(() => {
    const months = [];
    for (let month = 0; month < 12; month++) {
      const date = new Date(selectedYear, month, 1);
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const fd = aggregateFinancials(sharedData, { start, end });
      const hasData = fd.totalRevenue > 0 || fd.totalExpenses > 0;

      months.push({
        month: format(date, "MMM"),
        monthFull: format(date, "MMMM"),
        etsySales: fd.revenue.netEtsySales || 0,
        customSales: fd.revenue.customRevenueTotal || 0,
        totalRevenue: fd.totalRevenue || 0,
        sellingFees: fd.sellingExpenses.total || 0,
        productCosts: fd.productExpenses.total || 0,
        businessExpenses: fd.businessExpenses.total || 0,
        totalExpenses: fd.totalExpenses || 0,
        netProfit: fd.netProfit || 0,
        profitMargin: fd.profitMargin || 0,
        hasData,
      });
    }
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, expenses, fees, etsyStatementLines, etsyStatementImports]);

  const yearlyTotals = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 11, 31));
    const fd = aggregateFinancials(sharedData, { start: yearStart, end: yearEnd });
    return {
      etsySales: fd.revenue.netEtsySales || 0,
      customSales: fd.revenue.customRevenueTotal || 0,
      totalRevenue: fd.totalRevenue || 0,
      sellingFees: fd.sellingExpenses.total || 0,
      productCosts: fd.productExpenses.total || 0,
      businessExpenses: fd.businessExpenses.total || 0,
      totalExpenses: fd.totalExpenses || 0,
      netProfit: fd.netProfit || 0,
      profitMargin: fd.profitMargin || 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, expenses, fees, etsyStatementLines, etsyStatementImports]);

  const yearlyDetail = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 11, 31));
    return aggregateFinancials(sharedData, { start: yearStart, end: yearEnd });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, expenses, fees, etsyStatementLines, etsyStatementImports]);

  const expenseChartData = useMemo(() => {
    if (!yearlyDetail) return [];
    const items = [
      { name: "Materials & Supplies", value: yearlyDetail.productExpenses?.materialsSupplies || 0, color: "#3b82f6" },
      { name: "Tools & Equipment", value: yearlyDetail.productExpenses?.toolsEquipment || 0, color: "#f59e0b" },
      { name: "Listing Fees", value: yearlyDetail.sellingExpenses?.etsyListingFees || 0, color: "#fb923c" },
      { name: "Transaction Fees", value: yearlyDetail.sellingExpenses?.etsyTransactionFees || 0, color: "#f97316" },
      { name: "Processing Fees", value: yearlyDetail.sellingExpenses?.etsyProcessingFees || 0, color: "#ea580c" },
      { name: "Other Fees", value: yearlyDetail.sellingExpenses?.otherFees || 0, color: "#c2410c" },
      { name: "Etsy Ads", value: yearlyDetail.sellingExpenses?.etsyAds || 0, color: "#fbbf24" },
      { name: "Offsite Ads", value: yearlyDetail.sellingExpenses?.etsyOffsiteAds || 0, color: "#d97706" },
      { name: "Etsy Plus Subscription", value: yearlyDetail.sellingExpenses?.etsyPlusSubscription || 0, color: "#b45309" },
      { name: "Shipping Labels", value: yearlyDetail.sellingExpenses?.etsyShipping || 0, color: "#eab308" },
      { name: "Other Postage", value: yearlyDetail.sellingExpenses?.otherPostage || 0, color: "#facc15" },
      { name: "Share & Save Credits", value: Math.abs(yearlyDetail.sellingExpenses?.shareSaveRefunds || 0), color: "#34d399" },
      { name: "Fee Credits", value: yearlyDetail.sellingExpenses?.feeCredits || 0, color: "#6ee7b7" },
      { name: "Advertising & Marketing", value: yearlyDetail.businessExpenses?.advertisingMarketing || 0, color: "#ec4899" },
      { name: "Office Expenses", value: yearlyDetail.businessExpenses?.officeExpenses || 0, color: "#10b981" },
      { name: "Gas / Mileage", value: yearlyDetail.businessExpenses?.gasMileage || 0, color: "#06b6d4" },
      { name: "Utilities / Cell Phone", value: yearlyDetail.businessExpenses?.utilitiesCellPhone || 0, color: "#6366f1" },
      { name: "Software / Subscriptions", value: yearlyDetail.businessExpenses?.softwareSubscriptions || 0, color: "#8b5cf6" },
      { name: "Professional Services", value: yearlyDetail.businessExpenses?.professionalServices || 0, color: "#a855f7" },
      { name: "Payment Processing Fees", value: yearlyDetail.businessExpenses?.paymentProcessingFees || 0, color: "#f43f5e" },
      { name: "Insurance", value: yearlyDetail.businessExpenses?.insurance || 0, color: "#84cc16" },
      { name: "Rent / Lease", value: yearlyDetail.businessExpenses?.rent || 0, color: "#d946ef" },
      { name: "Shipping & Postage", value: yearlyDetail.businessExpenses?.shippingPostage || 0, color: "#ca8a04" },
      { name: "Other", value: yearlyDetail.businessExpenses?.other || 0, color: "#78716c" },
      { name: "Miscellaneous", value: yearlyDetail.businessExpenses?.miscellaneous || 0, color: "#a8a29e" },
    ];
    return items.filter(i => i.value > 0.01);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearlyDetail]);

  const salesChartData = useMemo(() => {
    if (!yearlyDetail?.revenue?.bySource) return [];
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
    return Object.entries(yearlyDetail.revenue.bySource)
      .filter(([_, value]) => value > 0.01)
      .map(([name, value]) => ({ name, value, color: colors[name] || "#78716c" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearlyDetail]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    const currentYr = new Date().getFullYear();
    years.add(currentYr);
    years.add(currentYr - 1);
    etsyOrders.forEach(o => { if (o.sale_date) years.add(new Date(o.sale_date).getFullYear()); });
    customSales.forEach(s => { if (s.date) years.add(new Date(s.date).getFullYear()); });
    businessExpenses.forEach(e => { if (e.date) years.add(new Date(e.date).getFullYear()); });
    return Array.from(years).sort((a, b) => b - a);
  }, [etsyOrders, customSales, businessExpenses]);

  const exportReport = () => {
    const rows = monthlyData.filter(m => m.hasData);
    const csv = [
      ["Month", "Etsy Sales", "Custom Sales", "Total Revenue", "Total Expenses", "Net Profit", "Profit Margin %"],
      ...rows.map(m => [
        m.monthFull, m.etsySales.toFixed(2), m.customSales.toFixed(2),
        m.totalRevenue.toFixed(2), m.totalExpenses.toFixed(2), m.netProfit.toFixed(2),
        m.profitMargin ? m.profitMargin.toFixed(1) : "0",
      ]),
      ["TOTAL", yearlyTotals.etsySales.toFixed(2), yearlyTotals.customSales.toFixed(2),
        yearlyTotals.totalRevenue.toFixed(2), yearlyTotals.totalExpenses.toFixed(2),
        yearlyTotals.netProfit.toFixed(2),
        yearlyTotals.profitMargin ? yearlyTotals.profitMargin.toFixed(1) : "0"],
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-report-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Monthly P&L Summary">
        <div className="flex gap-2 items-center">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </PageHeader>

      {/* Yearly Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Revenue ({selectedYear})</p>
                <p className="text-2xl font-bold text-stone-900">{formatCurrency(yearlyTotals.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-lg">
                <Receipt className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Expenses</p>
                <p className="text-2xl font-bold text-stone-900">{formatCurrency(yearlyTotals.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${yearlyTotals.netProfit >= 0 ? "bg-emerald-100" : "bg-rose-100"}`}>
                {yearlyTotals.netProfit >= 0 ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-rose-600" />}
              </div>
              <div>
                <p className="text-sm text-stone-500">Net Profit</p>
                <p className={`text-2xl font-bold ${yearlyTotals.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(yearlyTotals.netProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Profit Margin</p>
                <p className="text-2xl font-bold text-stone-900">{yearlyTotals.profitMargin ? yearlyTotals.profitMargin.toFixed(1) : "0"}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state instructions for new users */}
      {yearlyTotals.totalRevenue === 0 && yearlyTotals.totalExpenses === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">No data for {selectedYear}</p>
              <p className="text-sm text-blue-700 mt-1">
                Your monthly P&L summary will appear here once you import your Etsy statements and add expenses.
                Use the year selector to view different years, and the Export CSV button to download your report.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Donut Charts & P&L Statement */}
      {(yearlyTotals.totalRevenue > 0 || yearlyTotals.totalExpenses > 0) && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {expenseChartData.length > 0 ? (
                  <DonutChart data={expenseChartData} totalLabel="Total Expenses" />
                ) : (
                  <p className="text-sm text-stone-500 text-center py-8">No expense data for {selectedYear}</p>
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
                  <p className="text-sm text-stone-500 text-center py-8">No sales data for {selectedYear}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <ProfitLossStatement data={yearlyDetail} year={selectedYear} />
        </>
      )}

      {/* Monthly Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly P&L Summary — {selectedYear}</CardTitle>
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
                    <td className="py-3 px-2 font-medium text-stone-900">{m.month}</td>
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
                  <td className="text-right py-3 px-2 text-emerald-600">{formatCurrency(yearlyTotals.etsySales)}</td>
                  <td className="text-right py-3 px-2 text-blue-600">{formatCurrency(yearlyTotals.customSales)}</td>
                  <td className="text-right py-3 px-2 text-stone-900">{formatCurrency(yearlyTotals.totalRevenue)}</td>
                  <td className="text-right py-3 px-2 text-stone-900">{formatCurrency(yearlyTotals.totalExpenses)}</td>
                  <td className={`text-right py-3 px-2 ${yearlyTotals.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(yearlyTotals.netProfit)}</td>
                  <td className="text-right py-3 px-2 text-stone-700">{yearlyTotals.profitMargin ? yearlyTotals.profitMargin.toFixed(1) : "0"}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}