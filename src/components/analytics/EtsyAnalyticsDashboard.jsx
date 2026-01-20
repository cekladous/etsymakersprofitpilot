import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"];

export default function EtsyAnalyticsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("6months");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("all");

  const { data: etsyOrders = [] } = useQuery({
    queryKey: ["etsy-orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyOrder.filter({ owner_user_id: user.id }, "-sale_date", 1000),
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Calculate date range
  const dateRange = useMemo(() => {
    let start, end;
    end = new Date();

    if (customStartDate && customEndDate) {
      start = customStartDate;
      end = customEndDate;
    } else if (timeRange === "month") {
      start = startOfMonth(new Date());
    } else if (timeRange === "3months") {
      start = subMonths(end, 3);
    } else if (timeRange === "6months") {
      start = subMonths(end, 6);
    } else if (timeRange === "year") {
      start = subMonths(end, 12);
    }

    return { start, end };
  }, [timeRange, customStartDate, customEndDate]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return etsyOrders.filter((order) => {
      const orderDate = new Date(order.sale_date);
      return orderDate >= dateRange.start && orderDate <= dateRange.end;
    });
  }, [etsyOrders, dateRange]);

  // Revenue over time (by month)
  const revenueByMonth = useMemo(() => {
    const monthlyData = {};

    filteredOrders.forEach((order) => {
      const date = new Date(order.sale_date);
      const monthKey = format(date, "MMM yyyy");
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += (order.order_value || 0) + (order.shipping_charged || 0);
    });

    return Object.entries(monthlyData)
      .map(([month, revenue]) => ({
        month,
        revenue,
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));
  }, [filteredOrders]);



  // Key metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + ((o.order_value || 0) + (o.shipping_charged || 0)), 0);
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalItems = filteredOrders.reduce((sum, o) => sum + (o.number_of_items || 1), 0);

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      totalItems,
    };
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-2">
          {["month", "3months", "6months", "year"].map((range) => (
            <Button
              key={range}
              variant={timeRange === range && !customStartDate ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTimeRange(range);
                setCustomStartDate(null);
                setCustomEndDate(null);
              }}
              className={
                timeRange === range && !customStartDate
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : ""
              }
            >
              {range === "month"
                ? "Month"
                : range === "3months"
                ? "3 Months"
                : range === "6months"
                ? "6 Months"
                : "Year"}
            </Button>
          ))}
        </div>

        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              {customStartDate && customEndDate
                ? `${format(customStartDate, "MMM d")} - ${format(customEndDate, "MMM d")}`
                : "Custom Range"}
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
                    setTimeRange("6months");
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-stone-500 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-stone-900">
                {formatCurrency(metrics.totalRevenue)}
              </p>
              <p className="text-xs text-stone-400 mt-1">{metrics.totalOrders} orders</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-stone-500 mb-1">Average Order Value</p>
              <p className="text-2xl font-bold text-stone-900">
                {formatCurrency(metrics.averageOrderValue)}
              </p>
              <p className="text-xs text-stone-400 mt-1">per order</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-stone-500 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-stone-900">{metrics.totalOrders}</p>
              <p className="text-xs text-stone-400 mt-1">{metrics.totalItems} items</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-stone-500 mb-1">Avg Items/Order</p>
              <p className="text-2xl font-bold text-stone-900">
                {metrics.totalOrders > 0 ? (metrics.totalItems / metrics.totalOrders).toFixed(1) : 0}
              </p>
              <p className="text-xs text-stone-400 mt-1">items per order</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time */}
      {revenueByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="month" stroke="#78716c" />
                <YAxis stroke="#78716c" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fafaf8", border: "1px solid #e7e5e4" }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ fill: "#059669" }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}


    </div>
  );
}