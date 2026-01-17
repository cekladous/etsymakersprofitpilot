import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  ShoppingBag,
  Layers,
  Percent,
  Upload,
  Download,
  Plus,
  Calendar,
  BarChart3,
  Table as TableIcon
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, subMonths, startOfQuarter, endOfQuarter, endOfYear, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import KPICard from "@/components/dashboard/KPICard";
import AlertCard from "@/components/dashboard/AlertCard";
import ProfitChart from "@/components/dashboard/ProfitChart";
import ProfitCalculatorWidget from "@/components/dashboard/ProfitCalculatorWidget";
import LowStockNotifications from "@/components/notifications/LowStockNotifications";
import MonthlySummaryKPIs from "@/components/monthly/MonthlySummaryKPIs";
import MonthlySummaryTable from "@/components/monthly/MonthlySummaryTable";
import BudgetTab from "@/components/monthly/BudgetTab";
import EtsyOrderImportDialog from "@/components/monthly/EtsyOrderImportDialog";
import EtsyLedgerImportDialog from "@/components/monthly/EtsyLedgerImportDialog";
import CustomSaleDialog from "@/components/monthly/CustomSaleDialog";
import BusinessExpenseDialog from "@/components/monthly/BusinessExpenseDialog";
import TransferDialog from "@/components/monthly/TransferDialog";
import { aggregateFinancials } from "@/components/shared/financialAggregator";
// xlsx imported dynamically in handleExport

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [ledgerImportDialogOpen, setLedgerImportDialogOpen] = useState(false);
  const [customSaleDialogOpen, setCustomSaleDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-sale_date"),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list("-created_date"),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => base44.entities.Expense.list("-date"),
  });

  const { data: sheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => base44.entities.MaterialSheet.list(),
  });

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes"],
    queryFn: () => base44.entities.MaterialType.list(),
  });

  const { data: etsyOrders = [] } = useQuery({
    queryKey: ["etsy-orders"],
    queryFn: () => base44.entities.EtsyOrder.list("-sale_date", 1000),
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees"],
    queryFn: () => base44.entities.OrderFee.list(),
  });

  const { data: customSales = [] } = useQuery({
    queryKey: ["custom-sales"],
    queryFn: () => base44.entities.CustomSale.list("-date", 1000),
  });

  const { data: businessExpenses = [] } = useQuery({
    queryKey: ["business-expenses"],
    queryFn: () => base44.entities.BusinessExpense.list("-date", 1000),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => base44.entities.Transfer.list("-date", 1000),
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases"],
    queryFn: () => base44.entities.MaterialPurchase.list("-purchase_date", 1000),
  });

  const { data: etsyLedgerEntries = [] } = useQuery({
    queryKey: ["etsy-ledger-entries"],
    queryFn: () => base44.entities.EtsyLedgerEntry.list("-entry_date", 5000),
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
    }, dateRange);
  }, [etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, dateRange]);

  // For backward compatibility with existing components
  const filteredSummaryData = financialData._rawData;

  const metrics = useMemo(() => {
    if (!periodStart || !periodEnd) {
      return {
        periodRevenue: 0,
        periodFees: 0,
        periodExpenses: 0,
        totalExpenses: 0,
        periodProfit: 0,
        periodMargin: 0,
        orderCount: 0,
      };
    }
    
    // Filter EtsyOrders for period (by transaction date = sale_date)
    const periodEtsyOrders = etsyOrders.filter(o => {
      const d = new Date(o.sale_date);
      return d >= periodStart && d <= periodEnd;
    });
    
    // Calculate revenue (exclude sales tax - pass-through to government)
    const periodRevenue = periodEtsyOrders.reduce((sum, o) => 
      sum + (o.order_value || 0), 0);
    
    // Calculate order fees (listing, transaction, processing, ads, shipping, etc.)
    const periodOrderFees = orderFees
      .filter(f => periodEtsyOrders.some(o => o.id === f.order_id))
      .reduce((sum, f) => {
        const fees = (f.listing_fees || 0) + 
                     (f.transaction_fees || 0) + 
                     (f.processing_fees || 0) + 
                     (f.other_fees || 0) + 
                     (f.etsy_ads || 0) + 
                     (f.offsite_ads_fees || 0) + 
                     (f.etsy_shipping || 0) + 
                     (f.other_postage_costs || 0);
        // Subtract credits (Share & Save refunds/credits are positive in DB)
        const credits = (f.share_save_refunds_credits || 0);
        return sum + fees - credits;
      }, 0);
    
    // Calculate business expenses (by transaction date, not created date)
    const periodBusinessExpenses = businessExpenses
      .filter(e => e?.date && new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // Total Expenses = Business Expenses + Order Fees (net of credits)
    const totalExpenses = periodBusinessExpenses + periodOrderFees;
    
    const periodProfit = periodRevenue - totalExpenses;
    const periodMargin = periodRevenue > 0 ? (periodProfit / periodRevenue) * 100 : 0;

    return {
      periodRevenue,
      periodFees: periodOrderFees,
      periodExpenses: periodBusinessExpenses,
      totalExpenses,
      periodProfit,
      periodMargin,
      orderCount: periodEtsyOrders.length,
    };
  }, [etsyOrders, orderFees, businessExpenses, periodStart, periodEnd]);

  // Alerts
  const ordersWithoutJobs = Array.isArray(orders) ? orders.filter(o => !o.job_id && o.status !== "shipped") : [];
  const uncategorizedExpenses = Array.isArray(expenses) ? expenses.filter(e => !e.is_categorized) : [];
  
  const lowStockSheets = Array.isArray(sheets) ? sheets.filter(sheet => {
    const type = Array.isArray(materialTypes) ? materialTypes.find(t => t.id === sheet.material_type_id) : null;
    return type && sheet.remaining_percentage <= 20 && sheet.status !== "depleted";
  }) : [];

  // Chart data
  const chartData = useMemo(() => {
    const periods = [];
    const monthsToShow = timeRange === "month" ? 6 : timeRange === "quarter" ? 6 : 12;
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = subMonths(selectedDate, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const periodEtsyOrders = etsyOrders.filter(o => {
        const d = new Date(o.sale_date);
        return d >= start && d <= end;
      });
      
      const revenue = periodEtsyOrders.reduce((sum, o) => 
        sum + (o.order_value || 0), 0);
      
      const fees = orderFees
        .filter(f => periodEtsyOrders.some(o => o.id === f.order_id))
        .reduce((sum, f) => sum + (f.total_fees || 0), 0);
      
      const periodExpenses = businessExpenses
        .filter(e => e?.date && new Date(e.date) >= start && new Date(e.date) <= end)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      
      periods.push({
        period: format(date, "MMM"),
        revenue: Math.round(revenue),
        profit: Math.round(revenue - fees - periodExpenses),
      });
    }
    
    return periods;
  }, [etsyOrders, orderFees, businessExpenses, timeRange, selectedDate]);

  const formatCurrency = (val) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
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

  const handleExport = async () => {
    const XLSX = (await import("xlsx")).default;
    const exportData = {
      "Period": getPeriodLabel(),
      "Total Revenue": metrics.periodRevenue,
      "Total Expenses": metrics.periodExpenses,
      "Net Profit": metrics.periodProfit,
    };

    const worksheet = XLSX.utils.json_to_sheet([exportData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
    XLSX.writeFile(workbook, `dashboard-${format(selectedDate, "yyyy-MM")}.xlsx`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={getPeriodLabel()}
      >
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-2 items-center">
            {["month", "quarter", "year"].map((range) => (
              <Button
                key={range}
                variant={timeRange === range && !customStartDate ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTimeRange(range);
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                }}
                className={timeRange === range && !customStartDate ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}
            
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
              }}
            >
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
              }}
            >
              →
            </Button>
          </div>
          
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                {customStartDate && customEndDate 
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
                  selected={{ from: customStartDate, to: customEndDate }}
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

      {/* KPI Cards - ALL CLICKABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to={createPageUrl("Orders")} className="block transition-transform hover:scale-105">
          <KPICard
            title="Revenue (excl. tax)"
            value={`$${metrics.periodRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`${metrics.orderCount} orders • View all orders`}
            icon={DollarSign}
            accentColor="emerald"
          />
        </Link>
        <div onClick={() => setActiveTab("summary")} className="cursor-pointer transition-transform hover:scale-105">
          <KPICard
            title="Net Profit"
            value={`$${metrics.periodProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`${metrics.periodMargin.toFixed(1)}% margin • View breakdown`}
            icon={TrendingUp}
            accentColor={metrics.periodProfit >= 0 ? "emerald" : "rose"}
          />
        </div>
        <Link to={createPageUrl("Orders")} className="block transition-transform hover:scale-105">
          <KPICard
            title="Total Fees"
            value={`$${metrics.periodFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Etsy + processing • View details"
            icon={Receipt}
            accentColor="rose"
          />
        </Link>
        <Link to={createPageUrl("Expenses")} className="block transition-transform hover:scale-105">
          <KPICard
            title="Total Expenses"
            value={`$${metrics.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`Fees + Business expenses • View all`}
            icon={Percent}
            accentColor="amber"
          />
        </Link>
      </div>

      {/* All Time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => setActiveTab("summary")}
          className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white cursor-pointer transition-transform hover:scale-105"
        >
          <p className="text-emerald-100 text-sm font-medium mb-1">Deposits from Etsy</p>
          <p className="text-3xl font-bold">${financialData.cashflow.etsyDeposits.toLocaleString()}</p>
          <p className="text-emerald-200 text-xs mt-1">{getPeriodLabel()} • Click for cashflow details</p>
        </div>
        <div 
          onClick={() => setActiveTab("budget")}
          className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-6 text-white cursor-pointer transition-transform hover:scale-105"
        >
          <p className="text-violet-100 text-sm font-medium mb-1">Actual Spending</p>
          <p className="text-3xl font-bold">${financialData.totalExpenses.toLocaleString()}</p>
          <p className="text-violet-200 text-xs mt-1">Spent • Click to view breakdown</p>
        </div>
      </div>

      {/* Alerts */}
      {(ordersWithoutJobs.length > 0 || lowStockSheets.length > 0 || uncategorizedExpenses.length > 0 || financialData.unmatchedLedgerEntries.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Needs Attention</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {financialData.unmatchedLedgerEntries.length > 0 && (
              <div onClick={() => setActiveTab("summary")} className="cursor-pointer">
                <AlertCard
                  title="Unmatched Ledger Rows"
                  count={financialData.unmatchedLedgerEntries.length}
                  description="Review and categorize Etsy entries"
                  type="danger"
                />
              </div>
            )}
            <Link to={createPageUrl("Jobs")} className="block">
              <AlertCard
                title="Orders Missing Jobs"
                count={ordersWithoutJobs.length}
                description="Create production jobs for these orders"
                type="warning"
              />
            </Link>
            <Link to={createPageUrl("Inventory")} className="block">
              <AlertCard
                title="Low Stock Materials"
                count={lowStockSheets.length}
                description="Sheets running low"
                type="warning"
              />
            </Link>
          </div>
        </div>
      )}

        {/* Low Stock Notifications */}
        <LowStockNotifications />

        {/* Chart and Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProfitChart
              data={chartData}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
          </div>
          <div>
            <ProfitCalculatorWidget />
          </div>
        </div>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6 mt-6">
          {/* Import/Export Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Sold Orders
            </Button>
            <Button variant="outline" onClick={() => setLedgerImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Payment Ledger
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Summary KPIs */}
          <MonthlySummaryKPIs financialData={financialData} />

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
          </div>

          {/* Summary Table */}
          <MonthlySummaryTable financialData={financialData} viewMode={timeRange} />
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <BudgetTab
            viewMode={timeRange}
            dateRange={dateRange}
            financialData={financialData}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EtsyOrderImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      <EtsyLedgerImportDialog
        open={ledgerImportDialogOpen}
        onOpenChange={setLedgerImportDialogOpen}
      />
      <CustomSaleDialog
        open={customSaleDialogOpen}
        onOpenChange={setCustomSaleDialogOpen}
      />
      <BusinessExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
      />
      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />
    </div>
  );
}