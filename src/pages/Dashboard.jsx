import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  ShoppingBag,
  Layers,
  Percent,
  Download,
  Plus,
  Calendar,
  BarChart3,
  Table as TableIcon } from
"lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, subMonths, startOfQuarter, endOfQuarter, endOfYear, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from
"@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import KPICard from "@/components/dashboard/KPICard";
import AlertCard from "@/components/dashboard/AlertCard";
import ProfitChart from "@/components/dashboard/ProfitChart";
import ProfitCalculatorWidget from "@/components/dashboard/ProfitCalculatorWidget";
import LowStockNotifications from "@/components/notifications/LowStockNotifications";
import NetProfitStatement from "@/components/monthly/NetProfitStatement";
import ActualsSpendingMatrix from "@/components/monthly/ActualsSpendingMatrix";
import BudgetTab from "@/components/monthly/BudgetTab";
import CustomSaleDialog from "@/components/monthly/CustomSaleDialog";
import BusinessExpenseDialog from "@/components/monthly/BusinessExpenseDialog";
import TransferDialog from "@/components/monthly/TransferDialog";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
import { calculateTotalExpenses } from "@/components/shared/expenseCalculator";
import ReconciliationWarning from "@/components/dashboard/ReconciliationWarning";
import ReconciliationCheckCard from "@/components/dashboard/ReconciliationCheckCard";
import CashflowReconciliationCard from "@/components/reconciliation/CashflowReconciliationCard";
import MonthCloseWorkflow from "@/components/reconciliation/MonthCloseWorkflow";

import ProductProfitabilityChart from "@/components/dashboard/ProductProfitabilityChart";

// xlsx imported dynamically in handleExport

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [customSaleDialogOpen, setCustomSaleDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [monthCloseOpen, setMonthCloseOpen] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id })
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Order.filter({ owner_user_id: user.id }, "-sale_date")
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Job.filter({ owner_user_id: user.id }, "-created_date")
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Expense.filter({ owner_user_id: user.id }, "-date")
  });

  const { data: sheets = [] } = useQuery({
    queryKey: ["sheets", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialSheet.filter({ owner_user_id: user.id })
  });

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialType.filter({ owner_user_id: user.id })
  });

  const { data: etsyOrders = [] } = useQuery({
    queryKey: ["etsy-orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyOrder.filter({ owner_user_id: user.id }, "-sale_date", 1000)
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.OrderFee.filter({ owner_user_id: user.id })
  });

  const { data: customSales = [] } = useQuery({
    queryKey: ["custom-sales", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.CustomSale.filter({ owner_user_id: user.id }, "-date", 1000)
  });

  const { data: businessExpenses = [] } = useQuery({
    queryKey: ["business-expenses", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BusinessExpense.filter({ owner_user_id: user.id }, "-date", 1000)
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Transfer.filter({ owner_user_id: user.id }, "-date", 1000)
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialPurchase.filter({ owner_user_id: user.id }, "-purchase_date", 1000)
  });

  const { data: etsyLedgerEntries = [] } = useQuery({
    queryKey: ["etsy-ledger-entries", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyLedgerEntry.filter({ owner_user_id: user.id }, "-entry_date", 5000)
  });

  const { data: fees = [] } = useQuery({
    queryKey: ["fees", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Fee.filter({ owner_user_id: user.id })
  });

  const { data: etsyStatementLines = [] } = useQuery({
    queryKey: ["etsy-statement-lines", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementLine.filter({ owner_user_id: user.id })
  });

  const { data: etsyStatementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementImport.filter({ owner_user_id: user.id })
  });

  const now = new Date();

  // Calculate date range based on selected timeRange or custom dates
  const dateRange = useMemo(() => {
    let start, end;

    // If custom dates are set, use those
    if (customStartDate && customEndDate) {
      start = customStartDate;
      end = customEndDate;
    } else if (timeRange === "month") {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    } else if (timeRange === "quarter") {
      start = startOfQuarter(selectedDate);
      end = endOfQuarter(selectedDate);
    } else if (timeRange === "year") {
      start = startOfYear(selectedDate);
      end = endOfYear(selectedDate);
    }
    return { start, end };
  }, [timeRange, selectedDate, customStartDate, customEndDate]);

  const { start: periodStart, end: periodEnd } = dateRange;
  const yearStart = startOfYear(now);

  // SINGLE SOURCE OF TRUTH - Use shared financial aggregator
  const financialData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) {
      return {
        totalRevenue: 0,
        netProfit: 0,
        totalExpenses: 0,
        profitMargin: 0,
        productExpenses: { materialsSupplies: 0 },
        cashflow: { etsyDeposits: 0 },
        unmatchedLedgerEntries: [],
        _rawData: { etsyOrders: [] }
      };
    }
    return aggregateFinancials({
      etsyOrders,
      customSales,
      businessExpenses,
      transfers,
      materialPurchases,
      etsyLedgerEntries,
      orderFees,
      expenses, // CRITICAL: Include legacy Expense entity
      fees,
      etsyStatementLines,
      etsyStatementImports
    }, dateRange);
  }, [etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, expenses, dateRange]);

  // For backward compatibility with existing components
  const filteredSummaryData = financialData._rawData;

  // Use shared expense calculator for perfect reconciliation
  const expenseMetrics = useMemo(() => {
    return calculateTotalExpenses({
      etsyOrders,
      orderFees,
      businessExpenses,
      expenses, // Include legacy expenses for complete reconciliation
      dateRange: periodStart && periodEnd ? { start: periodStart, end: periodEnd } : null
    });
  }, [etsyOrders, orderFees, businessExpenses, expenses, periodStart, periodEnd]);

  const metrics = useMemo(() => {
    if (!periodStart || !periodEnd) {
      return {
        periodRevenue: 0,
        periodFees: 0,
        periodExpenses: 0,
        totalExpenses: 0,
        periodProfit: 0,
        periodMargin: 0,
        orderCount: 0
      };
    }

    // Use financialData for all calculations to ensure consistency
    const toNumber = (v) => {
      const num = Number(v);
      return Number.isFinite(num) ? num : 0;
    };

    const periodRevenue = toNumber(financialData.totalRevenue);
    const totalExpenses = toNumber(financialData.totalExpenses);
    const periodOrderFees = toNumber(
      toNumber(financialData.sellingExpenses.etsyTransactionFees) +
      toNumber(financialData.sellingExpenses.etsyProcessingFees) +
      toNumber(financialData.sellingExpenses.etsyListingFees) +
      toNumber(financialData.sellingExpenses.otherFees) +
      toNumber(financialData.sellingExpenses.etsyAds) +
      toNumber(financialData.sellingExpenses.etsyOffsiteAdsFees)
    );
    const periodBusinessExpenses = toNumber(totalExpenses - periodOrderFees);

    const periodProfit = toNumber(financialData.netProfit);
    const periodMargin = toNumber(financialData.profitMargin);

    return {
      periodRevenue: toNumber(periodRevenue),
      periodFees: toNumber(periodOrderFees),
      periodExpenses: toNumber(periodBusinessExpenses),
      totalExpenses: toNumber(totalExpenses),
      periodProfit: toNumber(periodProfit),
      periodMargin: toNumber(periodMargin),
      orderCount: financialData._rawData.etsyOrders.length
    };
  }, [financialData]);

  // Alerts
  const ordersWithoutJobs = Array.isArray(orders) ? orders.filter((o) => !o.job_id && o.status !== "shipped") : [];
  const uncategorizedExpenses = Array.isArray(expenses) ? expenses.filter((e) => !e.is_categorized) : [];

  const lowStockSheets = Array.isArray(sheets) ? sheets.filter((sheet) => {
    const type = Array.isArray(materialTypes) ? materialTypes.find((t) => t.id === sheet.material_type_id) : null;
    return sheet.owner_user_id === user.id && type && sheet.remaining_percentage <= 20 && sheet.status !== "depleted";
  }) : [];

  // Chart data
  const chartData = useMemo(() => {
    const periods = [];
    const monthsToShow = timeRange === "month" ? 6 : timeRange === "quarter" ? 6 : 12;

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = subMonths(selectedDate, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const periodEtsyOrders = etsyOrders.filter((o) => {
        const d = new Date(o.sale_date);
        return d >= start && d <= end;
      });

      const revenue = periodEtsyOrders.reduce((sum, o) =>
      sum + (o.order_value || 0), 0);

      const fees = orderFees.
      filter((f) => periodEtsyOrders.some((o) => o.id === f.order_id)).
      reduce((sum, f) => sum + (f.total_fees || 0), 0);

      const periodExpenses = businessExpenses.
      filter((e) => e?.date && new Date(e.date) >= start && new Date(e.date) <= end).
      reduce((sum, e) => sum + (e.amount || 0), 0);

      periods.push({
        period: format(date, "MMM"),
        revenue: Math.round(revenue),
        profit: Math.round(revenue - fees - periodExpenses)
      });
    }

    return periods;
  }, [etsyOrders, orderFees, businessExpenses, timeRange, selectedDate]);

  const formatCurrency = (val) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getFirstName = () => {
    const userName = settings[0]?.user_name;
    if (userName) return userName.split(" ")[0];
    if (!user?.full_name) return "";
    return user.full_name.split(" ")[0];
  };

  const getPeriodLabel = () => {
    if (customStartDate && customEndDate) {
      return `${format(customStartDate, "MMM d, yyyy")} - ${format(customEndDate, "MMM d, yyyy")}`;
    }
    if (timeRange === "month") {
      return format(selectedDate, "MMMM yyyy");
    } else if (timeRange === "quarter") {
      const quarter = Math.floor(selectedDate.getMonth() / 3) + 1;
      return `Q${quarter} ${format(selectedDate, "yyyy")}`;
    } else if (timeRange === "year") {
      return format(selectedDate, "yyyy");
    }
    return format(selectedDate, "MMMM yyyy");
  };

  const handleExport = async (exportFormat) => {
    try {
      const response = await base44.functions.invoke('exportDashboardReport', {
        format: exportFormat,
        financialData,
        settings: settings[0] || {},
        periodLabel: getPeriodLabel()
      });

      const blob = new Blob([response.data], {
        type: exportFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${format(selectedDate, "yyyy-MM")}.${exportFormat === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export report. Please try again.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={getPeriodLabel()}>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-2 items-center">
            {["month", "quarter", "year"].map((range) =>
            <Button
              key={range}
              variant={timeRange === range && !customStartDate ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTimeRange(range);
                setCustomStartDate(null);
                setCustomEndDate(null);
              }}
              className={timeRange === range && !customStartDate ? "bg-emerald-600 hover:bg-emerald-700" : ""}>

                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            )}
            
            <div className="h-6 w-px bg-stone-300 mx-1"></div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (timeRange === "month") {
                  setSelectedDate(subMonths(selectedDate, 1));
                } else if (timeRange === "year") {
                  setSelectedDate(new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth()));
                }
              }}>

              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (timeRange === "month") {
                  setSelectedDate(subMonths(selectedDate, -1));
                } else if (timeRange === "year") {
                  setSelectedDate(new Date(selectedDate.getFullYear() + 1, selectedDate.getMonth()));
                }
              }}>

              →
            </Button>
          </div>
          
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                {customStartDate && customEndDate ?
                `${format(customStartDate, "MMM d")} - ${format(customEndDate, "MMM d")}` :
                format(selectedDate, timeRange === "year" ? "yyyy" : "MMM yyyy")
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <p className="text-sm text-stone-500">Select start and end dates</p>
                <CalendarComponent
                  mode="range"
                  selected={{ from: customStartDate, to: customEndDate }}
                  onSelect={(range) => {
                    setCustomStartDate(range?.from || null);
                    setCustomEndDate(range?.to || null);
                  }}
                  numberOfMonths={1} />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setCustomStartDate(null);
                      setCustomEndDate(null);
                      setDatePickerOpen(false);
                    }}
                    variant="outline"
                    className="flex-1">

                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setDatePickerOpen(false)}
                    className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                    disabled={!customStartDate || !customEndDate}>

                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-6 w-px bg-stone-300 mx-2"></div>

          <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={financialData.hasUnmatchedEntries}
            title={financialData.hasUnmatchedEntries ? "Reconcile unmatched entries before exporting" : ""}
            className="gap-2">
            <Download className="w-4 h-4" />
            PDF Report
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleExport('xlsx')}
            disabled={financialData.hasUnmatchedEntries}
            title={financialData.hasUnmatchedEntries ? "Reconcile unmatched entries before exporting" : ""}
            className="gap-2">
            <Download className="w-4 h-4" />
            Excel Report
          </Button>
          </div>
          </div>
          </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-stone-100">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="summary">
            <TableIcon className="w-4 h-4 mr-2" />
            Net Profit
          </TabsTrigger>
          <TabsTrigger value="budget">
            <BarChart3 className="w-4 h-4 mr-2" />
            Actuals
          </TabsTrigger>

        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-6">

      {/* Revenue Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link to={createPageUrl("Orders")} className="block">
          <div className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-stone-600 uppercase">Etsy Revenue</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">${financialData.revenue.netEtsySales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-stone-500 mt-2">{metrics.orderCount} orders</p>
            {financialData.revenue.etsyRefunds > 0 && (
              <p className="text-xs text-rose-600 mt-1">−${financialData.revenue.etsyRefunds.toFixed(2)} refunds</p>
            )}
          </div>
        </Link>
        <Link to={createPageUrl("CustomSales")} className="block">
          <div className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-stone-600 uppercase">Custom Revenue</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">${financialData.revenue.customRevenueTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-stone-500 mt-2">Direct sales & quotes</p>
          </div>
        </Link>
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl border border-emerald-200 p-4">
          <p className="text-xs font-semibold text-stone-600 uppercase">Total Revenue</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">${metrics.periodRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="flex justify-between text-xs text-stone-600 mt-2 pt-2 border-t border-stone-200">
            <span>Etsy: ${financialData.revenue.netEtsySales.toFixed(0)}</span>
            <span>Custom: ${financialData.revenue.customRevenueTotal.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards - ALL CLICKABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to={createPageUrl("Orders")} className="block transition-transform hover:scale-105">
          <KPICard
                title="Total Fees"
                value={`$${metrics.periodFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle="Etsy + processing • View details"
                icon={Receipt}
                accentColor="rose" />

        </Link>
        <div onClick={() => setActiveTab("summary")} className="cursor-pointer transition-transform hover:scale-105">
          <KPICard
                title="Net Profit"
                value={`$${metrics.periodProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle={`${metrics.periodMargin.toFixed(1)}% margin • View breakdown`}
                icon={TrendingUp}
                accentColor={metrics.periodProfit >= 0 ? "emerald" : "rose"} />

        </div>
        <Link
              to={createPageUrl("Expenses") + `?startDate=${format(periodStart, 'yyyy-MM-dd')}&endDate=${format(periodEnd, 'yyyy-MM-dd')}&range=${timeRange}&source=dashboard`}
              className="block transition-transform hover:scale-105">

          <KPICard
                title="Total Expenses"
                value={`$${metrics.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle={`Fees + Business expenses • View all`}
                icon={Percent}
                accentColor="amber" />

        </Link>
      </div>

      {/* All Time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
              onClick={() => setActiveTab("summary")}
              className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white cursor-pointer transition-transform hover:scale-105">

          <p className="text-emerald-100 text-sm font-medium mb-1">Deposits from Etsy</p>
          <p className="text-3xl font-bold">${financialData.cashflow.etsyDeposits.toLocaleString()}</p>
          <p className="text-emerald-200 text-xs mt-1">{getPeriodLabel()} • Click for cashflow details</p>
        </div>
        <div
              onClick={() => setActiveTab("budget")} className="bg-gray-800 text-white p-6 rounded-2xl from-violet-600 to-violet-700 cursor-pointer transition-transform hover:scale-105">


          <p className="text-violet-100 text-sm font-medium mb-1">Actual Spending</p>
          <p className="text-3xl font-bold">${financialData.totalExpenses.toLocaleString()}</p>
          <p className="text-violet-200 text-xs mt-1">Spent • Click to view breakdown</p>
        </div>
      </div>

      {/* Reconciliation Cards */}
      <ReconciliationCheckCard
        etsyOrders={etsyOrders}
        etsyStatementImports={etsyStatementImports}
        etsyStatementLines={etsyStatementLines}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />
      
      <CashflowReconciliationCard
        etsyOrders={etsyOrders}
        etsyStatementImports={etsyStatementImports}
        orderFees={orderFees}
        transfers={transfers}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />

      {/* Sales Tax Warning */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Sales Tax Tracking</p>
            <p className="text-sm text-blue-700 mt-1">
              Sales tax collected from Etsy orders is shown for reference only. MakerLedger does not automatically file or remit sales tax. 
              <strong> You are responsible for tracking, filing, and paying sales tax to your state.</strong> The app displays collected tax amounts to help with your records, but you must manage tax obligations separately.
            </p>
          </div>
        </div>
      </div>

      {/* Unmatched Rows Banner - CRITICAL */}
      {((financialData.unmatchedLedgerEntriesCount || 0) + (financialData.unmatchedStatementLinesCount || 0) > 0 || (financialData.deduplicationWarnings || []).length > 0) &&
         <Link to={createPageUrl("ReconciliationReview")} className="block">
         <div className={`rounded-xl p-4 hover:shadow-md transition-all border-l-4 ${
           financialData.unmatchedNetImpact !== 0 
             ? 'bg-red-50 border-red-300 border' 
             : 'bg-amber-50 border-amber-200 border'
         }`}>
           <div className="flex items-start justify-between gap-4">
             <div className="flex-1">
               <p className={`font-semibold ${financialData.unmatchedNetImpact !== 0 ? 'text-red-900' : 'text-amber-900'}`}>
                 {(financialData.unmatchedLedgerEntriesCount || 0) + (financialData.unmatchedStatementLinesCount || 0)} transactions need categorization
                 {(financialData.deduplicationWarnings || []).length > 0 && ' • Plus deduplication required'}
               </p>
               <p className={`text-sm mt-2 ${financialData.unmatchedNetImpact !== 0 ? 'text-red-800' : 'text-amber-700'}`}>
                 {(financialData.deduplicationWarnings || []).map((w, i) => <div key={i}>• {w}</div>)}
                 {((financialData.unmatchedLedgerEntriesCount || 0) + (financialData.unmatchedStatementLinesCount || 0) > 0) && 
                   <div className="mt-2">
                     • These entries are <strong>excluded from profit calculations</strong>
                     {financialData.unmatchedNetImpact !== 0 && (
                       <div className={`mt-1 font-semibold ${financialData.unmatchedNetImpact > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                         Potential impact: ${Math.abs(financialData.unmatchedNetImpact).toFixed(2)}
                       </div>
                     )}
                   </div>
                 }
               </p>
             </div>
             <Button variant={financialData.unmatchedNetImpact !== 0 ? "default" : "outline"} size="sm" className={financialData.unmatchedNetImpact !== 0 ? "bg-red-600 hover:bg-red-700" : "bg-white"}>
               Review & Reconcile
             </Button>
           </div>
         </div>
        </Link>
         }

      {/* Alerts */}
      {(ordersWithoutJobs.length > 0 || lowStockSheets.length > 0) &&
          <div className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Needs Attention</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Link to={createPageUrl("Jobs")} className="block">
              <AlertCard
                  title="Orders Missing Jobs"
                  count={ordersWithoutJobs.length}
                  description="Create production jobs for these orders"
                  type="warning" />

            </Link>
            <Link to={createPageUrl("Inventory") + "?tab=sheets"} className="block">
              <AlertCard
                  title="Low Stock Materials"
                  count={lowStockSheets.length}
                  description="Sheets running low"
                  type="warning" />

            </Link>
          </div>
        </div>
          }

        {/* Low Stock Notifications */}
        <LowStockNotifications />

        {/* Chart and Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProfitChart
                data={chartData}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange} />

          </div>
          <div>
            <ProfitCalculatorWidget />
          </div>
        </div>

        {/* Product Profitability */}
         <ProductProfitabilityChart financialData={financialData} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="summary" className="space-y-6 mt-6">
          {/* Reconciliation Warning */}
          <ReconciliationWarning
            dashboardTotal={metrics.totalExpenses}
            netProfitTotal={financialData.totalExpenses}
            actualsTotal={financialData.totalExpenses}
            periodLabel={getPeriodLabel()} />

          
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setCustomSaleDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Sale
            </Button>
            <Button variant="outline" onClick={() => setExpenseDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
            <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Transfer
            </Button>
            <Button onClick={() => setMonthCloseOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Close Month
            </Button>
          </div>

          {/* Net Profit Statement */}
          <NetProfitStatement financialData={financialData} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
           {/* Reconciliation Warning */}
           <div className="mb-6">
             <ReconciliationWarning
              dashboardTotal={metrics.totalExpenses}
              netProfitTotal={financialData.totalExpenses}
              actualsTotal={financialData.totalExpenses}
              periodLabel={getPeriodLabel()} />

           </div>

           <ActualsSpendingMatrix
            dateRange={dateRange}
            viewMode={timeRange}
            etsyOrders={etsyOrders}
            customSales={customSales}
            businessExpenses={businessExpenses}
            transfers={transfers}
            materialPurchases={materialPurchases}
            etsyLedgerEntries={etsyLedgerEntries}
            orderFees={orderFees}
            expenses={expenses} />

        </TabsContent>


        </Tabs>

      {/* Dialogs */}
      <CustomSaleDialog
        open={customSaleDialogOpen}
        onOpenChange={setCustomSaleDialogOpen} />

      <BusinessExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen} />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen} />

      <MonthCloseWorkflow
        open={monthCloseOpen}
        onOpenChange={setMonthCloseOpen}
        periodStart={periodStart}
        periodEnd={periodEnd}
        hasUnmatchedEntries={financialData.hasUnmatchedEntries}
        unmatchedCount={(financialData.unmatchedLedgerEntriesCount || 0) + (financialData.unmatchedStatementLinesCount || 0)}
        cashflowStatus="success" />

    </div>);

}