import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/ui/PageHeader";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
import {
  format, startOfMonth, endOfMonth, startOfYear, endOfYear,
  startOfQuarter, endOfQuarter, startOfDay, endOfDay,
} from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Download, Info, X } from "lucide-react";
import DonutChart from "@/components/reports/DonutChart";
import ProfitLossStatement from "@/components/reports/ProfitLossStatement";

export default function Reports() {
  const { user, loading } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [groupBy, setGroupBy] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const dataDeps = [etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, expenses, fees, etsyStatementLines, etsyStatementImports];

  const hasCustomRange = !!(dateFrom || dateTo);

  const effectiveRange = useMemo(() => {
    if (hasCustomRange) {
      const start = dateFrom ? startOfDay(new Date(dateFrom + "T00:00:00")) : startOfYear(new Date(selectedYear, 0, 1));
      const end = dateTo ? endOfDay(new Date(dateTo + "T23:59:59")) : endOfYear(new Date(selectedYear, 11, 31));
      return { start, end };
    }
    return {
      start: startOfYear(new Date(selectedYear, 0, 1)),
      end: endOfYear(new Date(selectedYear, 11, 31)),
    };
  }, [dateFrom, dateTo, selectedYear, hasCustomRange]);

  const periods = useMemo(() => {
    const { start, end } = effectiveRange;
    const result = [];

    if (groupBy === "quarter") {
      for (let q = 0; q < 4; q++) {
        const qStart = startOfMonth(new Date(selectedYear, q * 3, 1));
        const qEnd = endOfQuarter(qStart);
        if (qStart <= end && qEnd >= start) {
          const pStart = qStart < start ? start : qStart;
          const pEnd = qEnd > end ? end : qEnd;
          result.push({
            label: `Q${q + 1}`,
            labelFull: `Q${q + 1} (${format(qStart, "MMM")}–${format(endOfMonth(new Date(selectedYear, q * 3 + 2, 1)), "MMM")})`,
            start: pStart,
            end: pEnd,
          });
        }
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const mStart = startOfMonth(new Date(selectedYear, m, 1));
        const mEnd = endOfMonth(mStart);
        if (mStart <= end && mEnd >= start) {
          const pStart = mStart < start ? start : mStart;
          const pEnd = mEnd > end ? end : mEnd;
          result.push({
            label: format(mStart, "MMM"),
            labelFull: format(mStart, "MMMM"),
            start: pStart,
            end: pEnd,
          });
        }
      }
    }
    return result;
  }, [effectiveRange, groupBy, selectedYear]);

  const periodData = useMemo(() => {
    return periods.map(p => {
      const fd = aggregateFinancials(sharedData, { start: p.start, end: p.end });
      const hasData = fd.totalRevenue > 0 || fd.totalExpenses > 0;
      return {
        label: p.label,
        labelFull: p.labelFull,
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
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, ...dataDeps]);

  const rangeTotals = useMemo(() => {
    const fd = aggregateFinancials(sharedData, effectiveRange);
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
  }, [effectiveRange, ...dataDeps]);

  const rangeDetail = useMemo(() => {
    return aggregateFinancials(sharedData, effectiveRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRange, ...dataDeps]);

  const expenseChartData = useMemo(() => {
    if (!rangeDetail) return [];
    const items = [
      { name: "Materials & Supplies", value: rangeDetail.productExpenses?.materialsSupplies || 0, color: "#3b82f6" },
      { name: "Tools & Equipment", value: rangeDetail.productExpenses?.toolsEquipment || 0, color: "#f59e0b" },
      { name: "Listing Fees", value: rangeDetail.sellingExpenses?.etsyListingFees || 0, color: "#fb923c" },
      { name: "Transaction Fees", value: rangeDetail.sellingExpenses?.etsyTransactionFees || 0, color: "#f97316" },
      { name: "Processing Fees", value: rangeDetail.sellingExpenses?.etsyProcessingFees || 0, color: "#ea580c" },
      { name: "Other Fees", value: rangeDetail.sellingExpenses?.otherFees || 0, color: "#c2410c" },
      { name: "Etsy Ads", value: rangeDetail.sellingExpenses?.etsyAds || 0, color: "#fbbf24" },
      { name: "Offsite Ads", value: rangeDetail.sellingExpenses?.etsyOffsiteAds || 0, color: "#d97706" },
      { name: "Etsy Plus Subscription", value: rangeDetail.sellingExpenses?.etsyPlusSubscription || 0, color: "#b45309" },
      { name: "Shipping Labels", value: rangeDetail.sellingExpenses?.etsyShipping || 0, color: "#eab308" },
      { name: "Other Postage", value: rangeDetail.sellingExpenses?.otherPostage || 0, color: "#facc15" },
      { name: "Share & Save Credits", value: Math.abs(rangeDetail.sellingExpenses?.shareSaveRefunds || 0), color: "#34d399" },
      { name: "Fee Credits", value: rangeDetail.sellingExpenses?.feeCredits || 0, color: "#6ee7b7" },
      { name: "Advertising & Marketing", value: rangeDetail.businessExpenses?.advertisingMarketing || 0, color: "#ec4899" },
      { name: "Office Expenses", value: rangeDetail.businessExpenses?.officeExpenses || 0, color: "#10b981" },
      { name: "Gas / Mileage", value: rangeDetail.businessExpenses?.gasMileage || 0, color: "#06b6d4" },
      { name: "Utilities / Cell Phone", value: rangeDetail.businessExpenses?.utilitiesCellPhone || 0, color: "#6366f1" },
      { name: "Software / Subscriptions", value: rangeDetail.businessExpenses?.softwareSubscriptions || 0, color: "#8b5cf6" },
      { name: "Professional Services", value: rangeDetail.businessExpenses?.professionalServices || 0, color: "#a855f7" },
      { name: "Payment Processing Fees", value: rangeDetail.businessExpenses?.paymentProcessingFees || 0, color: "#f43f5e" },
      { name: "Insurance", value: rangeDetail.businessExpenses?.insurance || 0, color: "#84cc16" },
      { name: "Rent / Lease", value: rangeDetail.businessExpenses?.rent || 0, color: "#d946ef" },
      { name: "Shipping & Postage", value: rangeDetail.businessExpenses?.shippingPostage || 0, color: "#ca8a04" },
      { name: "Other", value: rangeDetail.businessExpenses?.other || 0, color: "#78716c" },
      { name: "Miscellaneous", value: rangeDetail.businessExpenses?.miscellaneous || 0, color: "#a8a29e" },
    ];
    return items.filter(i => i.value > 0.01);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDetail]);

  const salesChartData = useMemo(() => {
    if (!rangeDetail?.revenue?.bySource) return [];
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
    return Object.entries(rangeDetail.revenue.bySource)
      .filter(([_, value]) => value > 0.01)
      .map(([name, value]) => ({ name, value, color: colors[name] || "#78716c" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDetail]);

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

  const rangeLabel = hasCustomRange
    ? `${dateFrom ? format(new Date(dateFrom + "T00:00:00"), "MMM d, yyyy") : "Start"} – ${dateTo ? format(new Date(dateTo + "T00:00:00"), "MMM d, yyyy") : "End"}`
    : String(selectedYear);

  const exportReport = () => {
    const rows = periodData.filter(m => m.hasData);
    const csv = [
      ["Period", "Etsy Sales", "Custom Sales", "Total Revenue", "Total Expenses", "Net Profit", "Profit Margin %"],
      ...rows.map(m => [
        m.labelFull, m.etsySales.toFixed(2), m.customSales.toFixed(2),
        m.totalRevenue.toFixed(2), m.totalExpenses.toFixed(2), m.netProfit.toFixed(2),
        m.profitMargin ? m.profitMargin.toFixed(1) : "0",
      ]),
      ["TOTAL", rangeTotals.etsySales.toFixed(2), rangeTotals.customSales.toFixed(2),
        rangeTotals.totalRevenue.toFixed(2), rangeTotals.totalExpenses.toFixed(2),
        rangeTotals.netProfit.toFixed(2),
        rangeTotals.profitMargin ? rangeTotals.profitMargin.toFixed(1) : "0"],
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${groupBy}-${rangeLabel.replace(/[^\w-]/g, "_")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`Financial Summary — ${rangeLabel}`}>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28">
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

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium text-stone-500 mb-1 block">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 px-3 rounded-md border border-stone-200 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500 mb-1 block">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 px-3 rounded-md border border-stone-200 text-sm bg-white"
              />
            </div>
            {hasCustomRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
              >
                <X className="w-4 h-4 mr-1" />
                Clear Range
              </Button>
            )}
            <p className="text-xs text-stone-400 ml-auto">
              {hasCustomRange
                ? `Showing ${groupBy === "quarter" ? "quarterly" : "monthly"} data for ${rangeLabel}. Partial periods are prorated to the date range.`
                : `Showing ${groupBy === "quarter" ? "quarterly" : "monthly"} data for all of ${selectedYear}. Set a custom date range to narrow.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Revenue</p>
                <p className="text-2xl font-bold text-stone-900">{formatCurrency(rangeTotals.totalRevenue)}</p>
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
                <p className="text-2xl font-bold text-stone-900">{formatCurrency(rangeTotals.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${rangeTotals.netProfit >= 0 ? "bg-emerald-100" : "bg-rose-100"}`}>
                {rangeTotals.netProfit >= 0 ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-rose-600" />}
              </div>
              <div>
                <p className="text-sm text-stone-500">Net Profit</p>
                <p className={`text-2xl font-bold ${rangeTotals.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(rangeTotals.netProfit)}</p>
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
                <p className="text-2xl font-bold text-stone-900">{rangeTotals.profitMargin ? rangeTotals.profitMargin.toFixed(1) : "0"}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {rangeTotals.totalRevenue === 0 && rangeTotals.totalExpenses === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">No data for {rangeLabel}</p>
              <p className="text-sm text-blue-700 mt-1">
                Your financial summary will appear here once you import your Etsy statements and add expenses.
                Use the year selector and date range filter to narrow results, and Export CSV to download.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Donut Charts & P&L Statement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category — {rangeLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseChartData.length > 0 ? (
              <DonutChart data={expenseChartData} totalLabel="Total Expenses" />
            ) : (
              <p className="text-sm text-stone-500 text-center py-8">No expense data for {rangeLabel}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales by Source — {rangeLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {salesChartData.length > 0 ? (
              <DonutChart data={salesChartData} totalLabel="Total Sales" />
            ) : (
              <p className="text-sm text-stone-500 text-center py-8">No sales data for {rangeLabel}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ProfitLossStatement data={rangeDetail} year={rangeLabel} />

      {/* Period Table */}
      <Card>
        <CardHeader>
          <CardTitle>{groupBy === "quarter" ? "Quarterly" : "Monthly"} P&L Summary — {rangeLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-3 px-2 font-semibold text-stone-700">{groupBy === "quarter" ? "Quarter" : "Month"}</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Etsy Sales</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Custom Sales</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Total Revenue</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Total Expenses</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Net Profit</th>
                  <th className="text-right py-3 px-2 font-semibold text-stone-700">Margin</th>
                </tr>
              </thead>
              <tbody>
                {periodData.map((m, idx) => (
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
                  <td className="text-right py-3 px-2 text-emerald-600">{formatCurrency(rangeTotals.etsySales)}</td>
                  <td className="text-right py-3 px-2 text-blue-600">{formatCurrency(rangeTotals.customSales)}</td>
                  <td className="text-right py-3 px-2 text-stone-900">{formatCurrency(rangeTotals.totalRevenue)}</td>
                  <td className="text-right py-3 px-2 text-stone-900">{formatCurrency(rangeTotals.totalExpenses)}</td>
                  <td className={`text-right py-3 px-2 ${rangeTotals.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(rangeTotals.netProfit)}</td>
                  <td className="text-right py-3 px-2 text-stone-700">{rangeTotals.profitMargin ? rangeTotals.profitMargin.toFixed(1) : "0"}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}