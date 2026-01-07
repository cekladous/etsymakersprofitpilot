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
import * as XLSX from "xlsx";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
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
  
  // Calculate date range based on selected timeRange
  const dateRange = useMemo(() => {
    let start, end;
    if (timeRange === "month") {
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
  }, [timeRange, selectedDate]);

  const { start: periodStart, end: periodEnd } = dateRange;
  const yearStart = startOfYear(now);

  // Filter data by date range for summary tab
  const filteredSummaryData = useMemo(() => {
    const { start, end } = dateRange;
    
    const filterByDate = (items, dateField) => {
      return items.filter(item => {
        const itemDate = new Date(item[dateField]);
        return itemDate >= start && itemDate <= end;
      });
    };

    return {
      etsyOrders: filterByDate(etsyOrders, "sale_date"),
      customSales: filterByDate(customSales, "date"),
      businessExpenses: filterByDate(businessExpenses, "date"),
      transfers: filterByDate(transfers, "date"),
      materialPurchases: filterByDate(materialPurchases, "purchase_date"),
      etsyLedgerEntries: filterByDate(etsyLedgerEntries, "entry_date"),
      orderFees: orderFees,
    };
  }, [etsyOrders, customSales, businessExpenses, transfers, materialPurchases, etsyLedgerEntries, orderFees, dateRange]);

  const metrics = useMemo(() => {
    // Period calculations based on selected timeRange
    const periodOrders = orders.filter(o => {
      const d = new Date(o.sale_date);
      return d >= periodStart && d <= periodEnd;
    });
    
    const periodRevenue = periodOrders.reduce((sum, o) => 
      sum + (o.gross_total || 0) - (o.sales_tax || 0) - (o.refunds || 0), 0);
    
    const periodFees = periodOrders.reduce((sum, o) => 
      sum + (o.etsy_fees || 0) + (o.processing_fees || 0), 0);
    
    const periodExpenses = expenses
      .filter(e => new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const periodProfit = periodRevenue - periodFees - periodExpenses;
    const periodMargin = periodRevenue > 0 ? (periodProfit / periodRevenue) * 100 : 0;

    // All-time calculations
    const allTimeRevenue = orders.reduce((sum, o) => 
      sum + (o.gross_total || 0) - (o.sales_tax || 0) - (o.refunds || 0), 0);
    
    const allTimeFees = orders.reduce((sum, o) => 
      sum + (o.etsy_fees || 0) + (o.processing_fees || 0), 0);
    
    const allTimeExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const allTimeProfit = allTimeRevenue - allTimeFees - allTimeExpenses;

    // Material spend for period
    const materialExpenses = expenses
      .filter(e => e.category === "materials" && new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      periodRevenue,
      periodFees,
      periodExpenses,
      periodProfit,
      periodMargin,
      allTimeRevenue,
      allTimeProfit,
      materialExpenses,
      orderCount: periodOrders.length,
    };
  }, [orders, expenses, periodStart, periodEnd]);

  // Alerts
  const ordersWithoutJobs = orders.filter(o => !o.job_id && o.status !== "shipped");
  const uncategorizedExpenses = expenses.filter(e => !e.is_categorized);
  
  const lowStockSheets = sheets.filter(sheet => {
    const type = materialTypes.find(t => t.id === sheet.material_type_id);
    return type && sheet.remaining_percentage <= 20 && sheet.status !== "depleted";
  });

  // Chart data
  const chartData = useMemo(() => {
    const periods = [];
    const monthsToShow = timeRange === "month" ? 1 : timeRange === "quarter" ? 3 : 12;
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = subMonths(now, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const periodOrders = orders.filter(o => {
        const d = new Date(o.sale_date);
        return d >= start && d <= end;
      });
      
      const revenue = periodOrders.reduce((sum, o) => 
        sum + (o.gross_total || 0) - (o.sales_tax || 0) - (o.refunds || 0), 0);
      
      const fees = periodOrders.reduce((sum, o) => 
        sum + (o.etsy_fees || 0) + (o.processing_fees || 0), 0);
      
      const periodExpenses = expenses
        .filter(e => new Date(e.date) >= start && new Date(e.date) <= end)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      
      periods.push({
        period: format(date, "MMM"),
        revenue: Math.round(revenue),
        profit: Math.round(revenue - fees - periodExpenses),
      });
    }
    
    return periods;
  }, [orders, expenses, timeRange, now]);

  const formatCurrency = (val) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  const getPeriodLabel = () => {
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

  const handleExport = () => {
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
          <div className="flex gap-2">
            {["month", "quarter", "year"].map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}
          </div>
          
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                {format(selectedDate, timeRange === "year" ? "yyyy" : "MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setDatePickerOpen(false);
                  }
                }}
                initialFocus
              />
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
            Budget vs Actual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={`Revenue (${getPeriodLabel()})`}
          value={formatCurrency(metrics.periodRevenue)}
          subtitle={`${metrics.orderCount} orders`}
          icon={DollarSign}
          accentColor="emerald"
          linkTo={createPageUrl("Orders")}
        />
        <KPICard
          title={`Net Profit (${getPeriodLabel()})`}
          value={formatCurrency(metrics.periodProfit)}
          subtitle={`After fees & expenses`}
          icon={TrendingUp}
          accentColor={metrics.periodProfit >= 0 ? "emerald" : "rose"}
        />
        <KPICard
          title="Profit Margin"
          value={`${metrics.periodMargin.toFixed(1)}%`}
          subtitle="Revenue after costs"
          icon={Percent}
          accentColor="violet"
        />
        <KPICard
          title="Material Spend"
          value={formatCurrency(metrics.materialExpenses)}
          subtitle={getPeriodLabel()}
          icon={Layers}
          accentColor="amber"
          linkTo={createPageUrl("Materials")}
        />
      </div>

      {/* All Time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
          <p className="text-emerald-100 text-sm font-medium mb-1">All-Time Revenue</p>
          <p className="text-3xl font-bold">${metrics.allTimeRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-6 text-white">
          <p className="text-violet-100 text-sm font-medium mb-1">All-Time Profit</p>
          <p className="text-3xl font-bold">${metrics.allTimeProfit.toLocaleString()}</p>
        </div>
      </div>

      {/* Alerts */}
      {(ordersWithoutJobs.length > 0 || lowStockSheets.length > 0 || uncategorizedExpenses.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Needs Attention</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AlertCard
              title="Orders Missing Jobs"
              count={ordersWithoutJobs.length}
              description="Create production jobs for these orders"
              linkTo={createPageUrl("Orders") + "?filter=missing_job"}
              type="warning"
            />
            <AlertCard
              title="Low Stock Materials"
              count={lowStockSheets.length}
              description="Sheets running low"
              linkTo={createPageUrl("Materials") + "?filter=low_stock"}
              type="warning"
            />
            <AlertCard
              title="Uncategorized Expenses"
              count={uncategorizedExpenses.length}
              description="Review and categorize"
              linkTo={createPageUrl("Expenses") + "?filter=uncategorized"}
              type="info"
            />
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
          <MonthlySummaryKPIs
            filteredData={filteredSummaryData}
            dateRange={dateRange}
            viewMode={timeRange}
          />

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
          <MonthlySummaryTable
            filteredData={filteredSummaryData}
            viewMode={timeRange}
          />
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <BudgetTab
            viewMode={timeRange}
            dateRange={dateRange}
            filteredData={filteredSummaryData}
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