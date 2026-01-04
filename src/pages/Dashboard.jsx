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
  Percent
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import KPICard from "@/components/dashboard/KPICard";
import AlertCard from "@/components/dashboard/AlertCard";
import ProfitChart from "@/components/dashboard/ProfitChart";
import ProfitCalculatorWidget from "@/components/dashboard/ProfitCalculatorWidget";

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState("month");
  const [customYear, setCustomYear] = useState(new Date().getFullYear());
  const [customMonth, setCustomMonth] = useState(new Date().getMonth());

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

  const now = new Date();
  
  // Calculate date range based on selected timeRange
  const getDateRange = () => {
    if (timeRange === "custom_month") {
      const customDate = new Date(customYear, customMonth, 1);
      return {
        start: startOfMonth(customDate),
        end: endOfMonth(customDate),
      };
    } else if (timeRange === "custom_year") {
      const customDate = new Date(customYear, 0, 1);
      return {
        start: new Date(customYear, 0, 1),
        end: new Date(customYear, 11, 31, 23, 59, 59),
      };
    } else if (timeRange === "month") {
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    } else if (timeRange === "quarter") {
      const quarter = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
      return { start: quarterStart, end: quarterEnd };
    } else if (timeRange === "year") {
      return {
        start: startOfYear(now),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
      };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const { start: periodStart, end: periodEnd } = getDateRange();
  const yearStart = startOfYear(now);

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
    if (timeRange === "custom_month") {
      return format(new Date(customYear, customMonth), "MMMM yyyy");
    } else if (timeRange === "custom_year") {
      return `${customYear}`;
    } else if (timeRange === "month") {
      return "This Month";
    } else if (timeRange === "quarter") {
      return "This Quarter";
    } else if (timeRange === "year") {
      return "This Year";
    }
    return "This Month";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={getPeriodLabel()}
      >
        <div className="flex gap-2 flex-wrap">
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
      </PageHeader>

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
    </div>
  );
}