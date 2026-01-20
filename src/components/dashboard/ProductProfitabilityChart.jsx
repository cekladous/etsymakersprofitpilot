import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function ProductProfitabilityChart({ financialData, dateRange }) {
  const { user } = useAuth();
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Job.filter({ owner_user_id: user.id })
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Product.filter({ owner_user_id: user.id })
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Order.filter({ owner_user_id: user.id })
  });

  const chartData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return [];

    const periodStart = new Date(dateRange.start);
    const periodEnd = new Date(dateRange.end);

    const data = {};

    // Process each job
    jobs.forEach(job => {
      // Find orders linked to this job
      const jobOrders = (job.order_ids || []).map(orderId =>
        orders.find(o => o.id === orderId || o.order_id === orderId)
      ).filter(Boolean);

      if (jobOrders.length === 0) return;

      // Calculate revenue from orders
      const revenue = jobOrders.reduce((sum, order) => {
        const saleDate = new Date(order.sale_date);
        if (saleDate >= periodStart && saleDate <= periodEnd) {
          return sum + (order.gross_total || 0);
        }
        return sum;
      }, 0);

      // Calculate costs
      const material_cost = job.actual_material_cost || job.material_cost || 0;
      const labor_cost = (job.actual_labor_hours || 0) * (job.actual_labor_rate || 0);
      const total_cost = material_cost + labor_cost;

      // Get product name
      const product = products.find(p => p.id === job.product_id);
      const productName = product?.name || job.product_id || "Unknown";

      if (!data[productName]) {
        data[productName] = {
          name: productName,
          revenue: 0,
          cost: 0,
          profit: 0,
          margin: 0,
        };
      }

      data[productName].revenue += revenue;
      data[productName].cost += total_cost;
    });

    // Calculate profit and margin
    const result = Object.values(data).map(item => ({
      ...item,
      profit: item.revenue - item.cost,
      margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue * 100) : 0,
    }));

    return result.sort((a, b) => b.profit - a.profit);
  }, [jobs, products, orders, dateRange]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Profitability</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-stone-500">No product data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Profitability</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} />
            <YAxis />
            <Tooltip
              formatter={(value) => `$${value.toFixed(2)}`}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#059669" name="Revenue" />
            <Bar dataKey="cost" fill="#dc2626" name="Cost" />
            <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold text-stone-700">Margins by Product</p>
          {chartData.map(item => (
            <div key={item.name} className="flex justify-between text-xs py-1">
              <span className="text-stone-600">{item.name}</span>
              <span className={item.margin >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {item.margin.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}