import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import PageHeader from "@/components/ui/PageHeader";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
import {
  format, startOfMonth, endOfMonth, startOfYear, endOfYear,
  startOfQuarter, endOfQuarter, subMonths,
} from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Download, Info, Calendar } from "lucide-react";
import DonutChart from "@/components/reports/DonutChart";
import ProfitLossStatement from "@/components/reports/ProfitLossStatement";

export default function Reports() {
  const { user, loading } = useAuth();
  const [timeRange, setTimeRange] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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

  const hasCustomRange = !!(customStartDate && customEndDate);

  // Compute effective date range from timeRange/selectedDate or custom dates
  const effectiveRange = useMemo(() => {
    if (hasCustomRange) {
      return { start: startOfMonth(customStartDate), end: endOfMonth(customEndDate) };
    }
    if (timeRange === "month") {
      return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    } else if (timeRange === "quarter") {
      return { start: startOfQuarter(selectedDate), end: endOfQuarter(selectedDate) };
    } else {
      const yr = selectedDate.getFullYear();
      return { start: new Date(yr, 0, 1), end: new Date(yr, 11, 31, 23, 59, 59) };
    }
  }, [timeRange, selectedDate, customStartDate, customEndDate, hasCustomRange]);

  // Build period rows for the table — months within the selected range
  const periods = useMemo(() => {
    const { start, end } = effectiveRange;
    const result = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const pStart = startOfMonth(cursor);
      const pEnd = endOfMonth(cursor);
      result.push({
        label: format(pStart, "MMM"),
        labelFull: format(pStart, "MMMM"),
        start: pStart < start ? start : pStart,
        end: pEnd > end ? end : pEnd,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }, [effectiveRange]);

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

  const getPeriodLabel = () => {
    if (hasCustomRange) {
      return `${format(customStartDate, "MMM d")} - ${format(customEndDate, "MMM d, yyyy")}`;
    }
    if (timeRange === "month") return format(selectedDate, "MMMM yyyy");
    if (timeRange === "quarter") {
      const q = Math.floor(selectedDate.getMonth() / 3) + 1;
      return `Q${q} ${format(selectedDate, "yyyy")}`;
    }
    return format(selectedDate, "yyyy");
  };

  const rangeLabel = getPeriodLabel();

  const exportReport = () => {
    const rows = periodData.filter(m => m.hasData);
    const csv = [
      ["Month", "Etsy Sales", "Custom Sales", "Total Revenue", "Total Expenses", "Net Profit", "Profit Margin %"],
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
    a.download = `report-${rangeLabel.replace(/[^\w-]/g, "_")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={rangeLabel}>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-2 items-center">
            {["month", "quarter", "year"].map((range) => (
              <Button
                key={range}
                variant={timeRange === range && !hasCustomRange ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTimeRange(range);
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                }}
                className={timeRange === range && !hasCustomRange ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}

            <div className="h-6 w-px bg-stone-300 mx-1"></div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (timeRange === "month") setSelectedDate(subMonths(selectedDate, 1));
                else if (timeRange === "quarter") setSelectedDate(subMonths(selectedDate, 3));
                else if (timeRange === "year") setSelectedDate(new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth()));
              }}
            >
              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (timeRange === "month") setSelectedDate(subMonths(selectedDate, -1));
                else if (timeRange === "quarter") setSelectedDate(subMonths(selectedDate, -3));
                else if (timeRange === "year") setSelectedDate(new Date(selectedDate.getFullYear() + 1, selectedDate.getMonth()));
              }}
            >
              →
            </Button>
          </div>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                {hasCustomRange
                  ? `${format(customStartDate, "MMM d")} - ${format(customEndDate, "MMM d")}`
                  : format(selectedDate, timeRange === "year" ? "yyyy" : "MMM yyyy")
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <p className="text-sm text-stone-500">Select start and end dates</p>
                <CalendarComponent
                  mode="range"
                  selected={{ from: customStartDate || undefined, to: customEndDate || undefined }}
                  onSelect={(range) => {
                    setCustomStartDate(range?.from || null);
                    setCustomEndDate(range?.to || null);
                  }}
                  numberOfMonths={1}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setCustomStartDate(null);
                      setCustomEndDate(null);
                      setDatePickerOpen(false);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setDatePickerOpen(false)}
                    className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                    disabled={!customStartDate || !customEndDate}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-6 w-px bg-stone-300 mx-2"></div>

          <Button variant="outline" size="sm" onClick={exportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </PageHeader>

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
                Use the date selector to pick a different period, or set a custom date range.
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

      {/* Monthly Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown — {rangeLabel}</CardTitle>
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