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
import PageHeader from "@/components/ui/PageHeader";
import KPICard from "@/components/dashboard/KPICard";
import AlertCard from "@/components/dashboard/AlertCard";
import ProfitChart from "@/components/dashboard/ProfitChart";
import ProfitCalculatorWidget from "@/components/dashboard/ProfitCalculatorWidget";

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState("month");

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
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);

  const metrics = useMemo(() => {
    // Month calculations
    const monthOrders = orders.filter(o => {
      const d = new Date(o.sale_date);
      return d >= monthStart && d <= monthEnd;
    });
    
    const monthRevenue = monthOrders.reduce((sum, o) => 
      sum + (o.gross_total || 0) - (o.sales_tax || 0) - (o.refunds || 0), 0);
    
    const monthFees = monthOrders.reduce((sum, o) => 
      sum + (o.etsy_fees || 0) + (o.processing_fees || 0), 0);
    
    const monthExpenses = expenses
      .filter(e => new Date(e.date) >= monthStart && new Date(e.date) <= monthEnd)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const monthProfit = monthRevenue - monthFees - monthExpenses;
    const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;

    // All-time calculations
    const allTimeRevenue = orders.reduce((sum, o) => 
      sum + (o.gross_total || 0) - (o.sales_tax || 0) - (o.refunds || 0), 0);
    
    const allTimeFees = orders.reduce((sum, o) => 
      sum + (o.etsy_fees || 0) + (o.processing_fees || 0), 0);
    
    const allTimeExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const allTimeProfit = allTimeRevenue - allTimeFees - allTimeExpenses;

    // Material spend this month
    const materialExpenses = expenses
      .filter(e => e.category === "materials" && new Date(e.date) >= monthStart)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      monthRevenue,
      monthFees,
      monthExpenses,
      monthProfit,
      monthMargin,
      allTimeRevenue,
      allTimeProfit,
      materialExpenses,
      orderCount: monthOrders.length,
    };
  }, [orders, expenses, monthStart, monthEnd]);

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={format(now, "MMMM yyyy")}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Revenue (This Month)"
          value={formatCurrency(metrics.monthRevenue)}
          subtitle={`${metrics.orderCount} orders`}
          icon={DollarSign}
          accentColor="emerald"
          linkTo={createPageUrl("Orders")}
        />
        <KPICard
          title="Net Profit (This Month)"
          value={formatCurrency(metrics.monthProfit)}
          subtitle={`After fees & expenses`}
          icon={TrendingUp}
          accentColor={metrics.monthProfit >= 0 ? "emerald" : "rose"}
        />
        <KPICard
          title="Profit Margin"
          value={`${metrics.monthMargin.toFixed(1)}%`}
          subtitle="Revenue after costs"
          icon={Percent}
          accentColor="violet"
        />
        <KPICard
          title="Material Spend"
          value={formatCurrency(metrics.materialExpenses)}
          subtitle="This month"
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