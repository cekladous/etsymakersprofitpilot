import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Calendar, Zap, Wrench, Copy, AlertTriangle, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import CustomSaleDialog from "@/components/monthly/CustomSaleDialog";
import QuickAddSaleDialog from "@/components/monthly/QuickAddSaleDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";

export default function CustomSalesPage() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [dateRange, setDateRange] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [fixing, setFixing] = useState(false);
  const [dupScan, setDupScan] = useState(null); // null | { loading, result, error }
  const [dupDeleting, setDupDeleting] = useState(false);

  const queryClient = useQueryClient();

  const { data: customSales = [], isLoading } = useQuery({
    queryKey: ["custom-sales", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.CustomSale.filter({ owner_user_id: user.id }, "-date", 500),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Product.filter({ owner_user_id: user.id }),
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

  const handleFixSales = async () => {
    setFixing(true);
    try {
      const invokePromise = base44.functions.invoke('fixCustomSaleOwnership', {});
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000)
      );
      const res = await Promise.race([invokePromise, timeoutPromise]);
      const data = res.data || res;
      if (data.recreated > 0) {
        queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
      }
      alert(data.message || `Fix complete: ${data.recreated || 0} records recreated.`);
    } catch (err) {
      console.error("Fix failed:", err);
      alert("Fix failed: " + (err.message || "Unknown error"));
    } finally {
      setFixing(false);
    }
  };

  const allTimeSales = customSales.reduce((sum, sale) => sum + (sale.gross_sale || 0), 0);

  // Running totals for Quick Add
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const todaySales = customSales.filter(s => s.date === today).reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  const monthSales = customSales.filter(s => s.date.startsWith(thisMonth)).reduce((sum, s) => sum + (s.gross_sale || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Sales"
        description="Track direct sales, quotes, and non-Etsy revenue"
      >
        <div className="flex gap-2">
          <Button 
            onClick={() => setQuickAddOpen(true)} 
            className="bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <Zap className="w-4 h-4 mr-2" />
            Quick Add
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-stone-800 hover:bg-stone-900" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Sale
          </Button>
        </div>
      </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Today's Sales</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${todaySales.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This Month's Sales</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${monthSales.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">All-Time Sales</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${allTimeSales.toFixed(2)}</p></CardContent>
        </Card>
      </div>

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

        <Button
          variant="outline"
          size="sm"
          disabled={dupScan?.loading}
          onClick={async () => {
            setDupScan({ loading: true });
            try {
              const res = await base44.functions.invoke('deduplicateSales', {});
              setDupScan({ loading: false, result: res.data });
            } catch (err) {
              setDupScan({ loading: false, error: err.message });
            }
          }}
        >
          {dupScan?.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
          Check Duplicates
        </Button>

      </div>

      {/* Duplicate Results Dialog */}
      <Dialog open={!!dupScan && !dupScan?.loading} onOpenChange={(open) => !open && setDupScan(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Duplicate Check Results
            </DialogTitle>
            <DialogDescription>
              Found {dupScan?.result?.duplicate_count || 0} duplicate CustomSales that overlap with Etsy orders or each other.
            </DialogDescription>
          </DialogHeader>

          {dupScan?.result?.duplicates?.length > 0 ? (
            <div className="space-y-3 py-2">
              {dupScan.result.duplicates.map((dup, idx) => (
                <div key={dup.id} className="border rounded-lg p-3 bg-amber-50 border-amber-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-stone-600">
                      {dup.date} · ${(dup.gross_sale || 0).toFixed(2)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      dup.duplicate_type === 'etsy_order'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {dup.duplicate_type === 'etsy_order' ? 'Matches Etsy Order' : 'Duplicate CustomSale'}
                    </span>
                  </div>
                  <p className="text-sm text-stone-700">{dup.vendor || '—'}: {dup.description || '—'}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-stone-600">No duplicates found. Your sales data is clean.</p>
            </div>
          )}

          {dupScan?.result?.duplicates?.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDupScan(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={dupDeleting}
                onClick={async () => {
                  setDupDeleting(true);
                  try {
                    await base44.functions.invoke('deduplicateSales', {});
                    setDupScan(null);
                    queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
                  } catch (err) {
                    console.error("Delete failed:", err);
                  } finally {
                    setDupDeleting(false);
                  }
                }}
              >
                {dupDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Remove {dupScan?.result?.duplicates?.length || 0} Duplicates
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-stone-500">Loading...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-stone-500">
              <p>No custom sales found</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={fixing}
                onClick={handleFixSales}
              >
                <Wrench className="w-4 h-4 mr-2" />
                {fixing ? "Fixing..." : "Fix Missing Sales"}
              </Button>
            </div>
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
      <QuickAddSaleDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} products={products} />
    </div>
  );
}