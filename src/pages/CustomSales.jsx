import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import CustomSaleDialog from "@/components/monthly/CustomSaleDialog";
import { format, parseISO } from "date-fns";

export default function CustomSalesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  const queryClient = useQueryClient();

  const { data: customSales = [], isLoading } = useQuery({
    queryKey: ["custom-sales"],
    queryFn: () => base44.entities.CustomSale.list("-date", 500),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });

  const deleteCustomSaleMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomSale.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
    },
  });

  // Filter by date range
  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case "week":
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return weekAgo;
      case "month":
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case "year":
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(2000, 0, 1);
    }
  };

  const filteredSales = customSales
    .filter((sale) => {
      const saleDate = parseISO(sale.date);
      if (saleDate < getDateRangeStart()) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          sale.vendor?.toLowerCase().includes(search) ||
          sale.description?.toLowerCase().includes(search) ||
          sale.payment_source?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === "date") {
        aVal = parseISO(a.date);
        bVal = parseISO(b.date);
      }

      const comparison = aVal > bVal ? 1 : -1;
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const totalGross = filteredSales.reduce((sum, sale) => sum + (sale.gross_sale || 0), 0);
  const totalPreTax = filteredSales.reduce((sum, sale) => sum + (sale.pre_tax_amount || 0), 0);
  const totalTax = filteredSales.reduce((sum, sale) => sum + (sale.sales_tax_collected || 0), 0);
  const totalShipping = filteredSales.reduce((sum, sale) => sum + (sale.shipping_or_postage_cost || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Sales"
        description="Track direct sales, quotes, and non-Etsy revenue"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-600">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-stone-900">
              ${totalGross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-stone-500 mt-1">{filteredSales.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-600">Pre-Tax Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              ${totalPreTax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-600">Sales Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              ${totalTax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-stone-600">Shipping</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              ${totalShipping.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <Input
            placeholder="Search vendor, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64"
          />

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-md border border-stone-200 bg-white text-sm"
          >
            <option value="all">All Time</option>
            <option value="year">This Year</option>
            <option value="month">This Month</option>
            <option value="week">Last 7 Days</option>
            <option value="today">Today</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-md border border-stone-200 bg-white text-sm"
          >
            <option value="date">Date</option>
            <option value="gross_sale">Amount</option>
            <option value="vendor">Vendor</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-3 py-2 rounded-md border border-stone-200 bg-white text-sm hover:bg-stone-50"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <Button onClick={() => setDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Sale
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-stone-500">Loading...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-stone-500">No custom sales found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-stone-700">Date</th>
                    <th className="px-6 py-3 text-left font-semibold text-stone-700">Vendor</th>
                    <th className="px-6 py-3 text-left font-semibold text-stone-700">Description</th>
                    <th className="px-6 py-3 text-left font-semibold text-stone-700">Payment</th>
                    <th className="px-6 py-3 text-right font-semibold text-stone-700">Pre-Tax</th>
                    <th className="px-6 py-3 text-right font-semibold text-stone-700">Tax</th>
                    <th className="px-6 py-3 text-right font-semibold text-stone-700">Total</th>
                    <th className="px-6 py-3 text-center font-semibold text-stone-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-b border-stone-200 hover:bg-stone-50">
                      <td className="px-6 py-4 whitespace-nowrap text-stone-900">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-stone-400" />
                          {format(parseISO(sale.date), "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-stone-900 font-medium">{sale.vendor || "—"}</td>
                      <td className="px-6 py-4 text-stone-600">{sale.description || "—"}</td>
                      <td className="px-6 py-4 text-stone-600">{sale.payment_source || "—"}</td>
                      <td className="px-6 py-4 text-right text-stone-900">
                        ${(sale.pre_tax_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-stone-900">
                        ${(sale.sales_tax_collected || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-stone-900">
                        ${(sale.gross_sale || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => deleteCustomSaleMutation.mutate(sale.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomSaleDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}