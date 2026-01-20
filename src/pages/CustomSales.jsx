import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Trash2, Download, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, parse } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import CustomSaleDialog from "@/components/monthly/CustomSaleDialog";

export default function CustomSales() {
  const { user, loading } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [search, setSearch] = useState("");
  const [saleTypeFilter, setSaleTypeFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const queryClient = useQueryClient();

  const { data: customSales = [] } = useQuery({
    queryKey: ["custom-sales", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.CustomSale.filter({ owner_user_id: user.id }, "-date", 1000),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
  });

  const appSettings = settings[0] || {};
  const customSaleALabel = appSettings.custom_sale_a_label || "Custom Sale A";
  const customSaleBLabel = appSettings.custom_sale_b_label || "Custom Sale B";

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomSale.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => base44.entities.CustomSale.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
      setSelectedIds([]);
    },
  });

  // Calculate date range
  const dateRange = useMemo(() => {
    let start, end;

    if (customStartDate && customEndDate) {
      start = customStartDate;
      end = customEndDate;
    } else if (timeRange === "month") {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    } else if (timeRange === "year") {
      start = startOfYear(selectedDate);
      end = endOfYear(selectedDate);
    }

    return start && end ? { start, end } : null;
  }, [timeRange, selectedDate, customStartDate, customEndDate]);

  // Filter sales
  const filteredSales = useMemo(() => {
    let filtered = [...customSales];

    // Apply date range
    if (dateRange) {
      filtered = filtered.filter((sale) => {
        const saleDate = new Date(sale.date);
        return saleDate >= dateRange.start && saleDate <= dateRange.end;
      });
    }

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          (sale.vendor || "").toLowerCase().includes(searchLower) ||
          (sale.description || "").toLowerCase().includes(searchLower)
      );
    }

    // Apply sale type filter
    if (saleTypeFilter !== "all") {
      filtered = filtered.filter((sale) => sale.sale_type === saleTypeFilter);
    }

    return filtered;
  }, [customSales, dateRange, search, saleTypeFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredSales.reduce((sum, s) => sum + (s.pre_tax_amount || 0), 0);
    const taxCollected = filteredSales.reduce((sum, s) => sum + (s.sales_tax_collected || 0), 0);
    const grossTotal = filteredSales.reduce((sum, s) => sum + (s.gross_sale || 0), 0);

    return {
      count: filteredSales.length,
      preTax: total,
      taxCollected,
      grossTotal,
      avgSale: filteredSales.length > 0 ? total / filteredSales.length : 0,
    };
  }, [filteredSales]);

  const getPeriodLabel = () => {
    if (customStartDate && customEndDate) {
      return `${format(customStartDate, "MMM d, yyyy")} - ${format(customEndDate, "MMM d, yyyy")}`;
    }
    if (timeRange === "month") {
      return format(selectedDate, "MMMM yyyy");
    } else if (timeRange === "year") {
      return format(selectedDate, "yyyy");
    }
    return "All Time";
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.length} sale(s)?`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSales.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSales.map((s) => s.id));
    }
  };

  const columns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.length === filteredSales.length && filteredSales.length > 0}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelect(row.id)}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
    },
    {
      header: "Date",
      render: (row) => format(new Date(row.date), "MMM d, yyyy"),
    },
    {
      header: "Type",
      render: (row) => (
        <Badge variant="outline">
          {row.sale_type === "A" ? customSaleALabel : customSaleBLabel}
        </Badge>
      ),
    },
    {
      header: "Vendor/Customer",
      render: (row) => <span className="font-medium">{row.vendor || "-"}</span>,
    },
    {
      header: "Description",
      render: (row) => <span className="text-stone-600 text-sm">{row.description || "-"}</span>,
    },
    {
      header: "Payment",
      render: (row) => <span className="text-sm">{row.payment_source || "-"}</span>,
    },
    {
      header: "Pre-Tax",
      render: (row) => <span className="font-semibold">${(row.pre_tax_amount || 0).toFixed(2)}</span>,
    },
    {
      header: "Tax",
      render: (row) =>
        row.sales_tax_collected > 0 ? (
          <span className="text-stone-600">${row.sales_tax_collected.toFixed(2)}</span>
        ) : (
          <span className="text-stone-400">-</span>
        ),
    },
    {
      header: "Gross",
      render: (row) => (
        <span className="font-semibold text-emerald-600">${(row.gross_sale || 0).toFixed(2)}</span>
      ),
    },
    {
      header: "",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => deleteMutation.mutate(row.id)}
              className="text-rose-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Custom Sales" description={getPeriodLabel()}>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-2 items-center">
            {["month", "year"].map((range) => (
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
              onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
            >
              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(subMonths(selectedDate, -1))}
            >
              →
            </Button>

            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  {customStartDate && customEndDate
                    ? `${format(customStartDate, "MMM d")} - ${format(customEndDate, "MMM d")}`
                    : format(selectedDate, "MMM yyyy")}
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

          <div className="h-6 w-px bg-stone-300 mx-1"></div>

          <Button
            onClick={() => {
              setEditingSale(null);
              setFormOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Sale
          </Button>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{stats.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pre-Tax Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.pre税.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tax Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">${stats.taxCollected.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gross Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-stone-900">${stats.grossTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Search vendor or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={saleTypeFilter} onValueChange={setSaleTypeFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Sale Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="A">{customSaleALabel}</SelectItem>
              <SelectItem value="B">{customSaleBLabel}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-900">
            {selectedIds.length} sale{selectedIds.length !== 1 ? "s" : ""} selected
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Table */}
      {filteredSales.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No custom sales"
          description="Add your first custom or direct sale to get started."
          actionLabel="Add Sale"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <DataTable columns={columns} data={filteredSales} />
      )}

      {/* Dialog */}
      <CustomSaleDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingSale(null);
        }}
      />
    </div>
  );
}