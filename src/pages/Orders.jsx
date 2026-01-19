import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Upload, Search, Download, ShoppingBag, DollarSign, CreditCard, Trash2, Calendar, Info } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import * as XLSX from "xlsx";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import UnifiedEtsyStatementImport from "@/components/imports/UnifiedEtsyStatementImport";

export default function Orders() {
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const queryClient = useQueryClient();

  const { data: etsyOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["etsy-orders"],
    queryFn: () => base44.entities.EtsyOrder.list("-sale_date", 1000),
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees"],
    queryFn: () => base44.entities.OrderFee.list(),
  });

  const { data: etsyLedgerEntries = [] } = useQuery({
    queryKey: ["etsy-ledger-entries"],
    queryFn: () => base44.entities.EtsyLedgerEntry.list("-entry_date", 10000),
  });

  const { data: fees = [] } = useQuery({
    queryKey: ["fees"],
    queryFn: () => base44.entities.Fee.list(),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      // Delete associated fees first
      const feesToDelete = fees.filter(f => ids.includes(f.order_id));
      await Promise.all(feesToDelete.map(f => base44.entities.Fee.delete(f.id)));
      
      // Delete order fees
      const orderFeesToDelete = orderFees.filter(f => ids.includes(f.order_id));
      await Promise.all(orderFeesToDelete.map(f => base44.entities.OrderFee.delete(f.id)));
      
      // Then delete orders
      await Promise.all(ids.map(id => base44.entities.EtsyOrder.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      setSelectedIds([]);
    },
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Calculate date range based on selected timeRange or custom dates
  const dateRange = useMemo(() => {
    if (timeRange === "all") return null;
    
    let start, end;
    
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
    return start && end ? { start, end } : null;
  }, [timeRange, selectedDate, customStartDate, customEndDate]);

  const filteredOrders = useMemo(() => {
    return etsyOrders.filter(order => {
      const matchesSearch = !search || 
        order.order_id?.toLowerCase().includes(search.toLowerCase()) ||
        order.buyer_username?.toLowerCase().includes(search.toLowerCase());
      
      let matchesDate = true;
      if (dateRange && order.sale_date) {
        const orderDate = new Date(order.sale_date);
        matchesDate = orderDate >= dateRange.start && orderDate <= dateRange.end;
      }
      
      return matchesSearch && matchesDate;
    });
  }, [etsyOrders, search, dateRange]);

  // Revenue excludes sales tax (pass-through to government)
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.order_value || 0) - (o.sales_tax || 0), 0);
  
  // Aggregate all fee categories for filtered orders
  const relevantOrderFees = orderFees.filter(f => filteredOrders.some(o => o.id === f.order_id));
  const totalFees = relevantOrderFees.reduce((sum, f) => sum + (f.total_fees || 0), 0);
  const feeBreakdown = {
    listing: relevantOrderFees.reduce((sum, f) => sum + (f.listing_fees || 0), 0),
    transaction: relevantOrderFees.reduce((sum, f) => sum + (f.transaction_fees || 0), 0),
    processing: relevantOrderFees.reduce((sum, f) => sum + (f.processing_fees || 0), 0),
    etsy_ads: relevantOrderFees.reduce((sum, f) => sum + (f.etsy_ads || 0), 0),
    offsite_ads: relevantOrderFees.reduce((sum, f) => sum + (f.offsite_ads_fees || 0), 0),
    shipping: relevantOrderFees.reduce((sum, f) => sum + (f.etsy_shipping || 0), 0),
    other_postage: relevantOrderFees.reduce((sum, f) => sum + (f.other_postage_costs || 0), 0),
    share_save: relevantOrderFees.reduce((sum, f) => sum + (f.share_save_refunds_credits || 0), 0),
    other: relevantOrderFees.reduce((sum, f) => sum + (f.other_fees || 0), 0),
  };
  
  const totalSalesTax = filteredOrders.reduce((sum, o) => sum + (o.sales_tax || 0), 0);

  const getPeriodLabel = () => {
    if (timeRange === "all") return "All Orders";
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
    return "All Orders";
  };

  const exportOrders = () => {
    const data = filteredOrders.map(o => {
      const fees = orderFees.find(f => f.order_id === o.id);
      return {
        "Order ID": o.order_id,
        "Date": o.sale_date,
        "Buyer": o.buyer_username,
        "Items": o.number_of_items,
        "Order Value": o.order_value,
        "Shipping": o.shipping_charged,
        "Sales Tax": o.sales_tax,
        "Total Fees": fees?.total_fees || 0,
        "Net": o.order_net,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `etsy-orders-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.length} order(s)? This will also delete associated fees.`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const columns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
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
      header: "Order ID",
      render: (row) => (
        <div>
          <p className="font-medium text-stone-900">#{row.order_id}</p>
          <p className="text-sm text-stone-500">{row.sale_date}</p>
        </div>
      ),
    },
    {
      header: "Buyer",
      render: (row) => (
        <div className="max-w-48">
          <p className="font-medium text-stone-900 truncate">{row.buyer_username || "-"}</p>
          <p className="text-sm text-stone-500">{row.number_of_items} item(s)</p>
        </div>
      ),
    },
    {
      header: "Order Value",
      render: (row) => (
        <span className="font-medium text-stone-900">
          {formatCurrency(row.order_value || 0)}
        </span>
      ),
    },
    {
      header: "Shipping",
      render: (row) => (
        <span className="text-stone-600">
          {formatCurrency(row.shipping_charged || 0)}
        </span>
      ),
    },
    {
      header: "Fees",
      render: (row) => {
        const fees = orderFees.find(f => f.order_id === row.id);
        if (!fees || fees.total_fees === 0) {
          return <span className="text-stone-400">—</span>;
        }
        
        const feeBreakdown = [
          { label: "Listing", value: fees.listing_fees },
          { label: "Transaction", value: fees.transaction_fees },
          { label: "Processing", value: fees.processing_fees },
          { label: "Etsy Ads", value: fees.etsy_ads },
          { label: "Offsite Ads", value: fees.offsite_ads_fees },
          { label: "Shipping Label", value: fees.etsy_shipping },
          { label: "Other Postage", value: fees.other_postage_costs },
          { label: "Share & Save Credit", value: fees.share_save_refunds_credits },
          { label: "Other", value: fees.other_fees },
        ].filter(item => item.value > 0);

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <span className="text-rose-600 font-medium">
                    {formatCurrency(fees.total_fees)}
                  </span>
                  <Info className="w-3 h-3 text-stone-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-xs mb-2">Fee Breakdown</p>
                  {feeBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between gap-4 text-xs">
                      <span className="text-stone-600">{item.label}:</span>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 mt-2 flex justify-between gap-4 text-xs font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(fees.total_fees)}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      header: "Net",
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {formatCurrency(row.order_net || 0)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Etsy Orders" description={getPeriodLabel()}>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Time Range Buttons */}
          <div className="flex gap-2 items-center">
            {["all", "month", "quarter", "year"].map((range) => (
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
                {range === "all" ? "All" : range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}
            
            {timeRange !== "all" && (
              <>
                <div className="h-6 w-px bg-stone-300 mx-1"></div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (timeRange === "month") {
                      setSelectedDate(subMonths(selectedDate, 1));
                    } else if (timeRange === "quarter") {
                      setSelectedDate(subMonths(selectedDate, 3));
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
                    } else if (timeRange === "quarter") {
                      setSelectedDate(subMonths(selectedDate, -3));
                    } else if (timeRange === "year") {
                      setSelectedDate(new Date(selectedDate.getFullYear() + 1, selectedDate.getMonth()));
                    }
                  }}
                >
                  →
                </Button>
              </>
            )}
          </div>
          
          {timeRange !== "all" && (
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
          )}

          <div className="h-6 w-px bg-stone-300 mx-1"></div>

          <Button variant="outline" size="sm" onClick={exportOrders}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Etsy Monthly Statement
          </Button>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Orders</p>
                <p className="text-2xl font-bold text-stone-900">
                  {filteredOrders.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Revenue (excl. tax)</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3 cursor-help">
                    <div className="p-3 bg-rose-100 rounded-lg">
                      <CreditCard className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm text-stone-500 flex items-center gap-1">
                        Total Fees
                        <Info className="w-3 h-3 text-stone-400" />
                      </p>
                      <p className="text-2xl font-bold text-stone-900">
                        {formatCurrency(totalFees)}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-xs mb-2">Fee Breakdown</p>
                    {feeBreakdown.listing > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Listing Fees:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.listing)}</span>
                      </div>
                    )}
                    {feeBreakdown.transaction > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Transaction Fees:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.transaction)}</span>
                      </div>
                    )}
                    {feeBreakdown.processing > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Processing Fees:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.processing)}</span>
                      </div>
                    )}
                    {feeBreakdown.etsy_ads > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Etsy Ads:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.etsy_ads)}</span>
                      </div>
                    )}
                    {feeBreakdown.offsite_ads > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Offsite Ads:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.offsite_ads)}</span>
                      </div>
                    )}
                    {feeBreakdown.shipping > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Shipping Labels:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.shipping)}</span>
                      </div>
                    )}
                    {feeBreakdown.other_postage > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Other Postage:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.other_postage)}</span>
                      </div>
                    )}
                    {feeBreakdown.share_save > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Share & Save Credits:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.share_save)}</span>
                      </div>
                    )}
                    {feeBreakdown.other > 0 && (
                      <div className="flex justify-between gap-4 text-xs">
                        <span className="text-stone-600">Other Fees:</span>
                        <span className="font-medium">{formatCurrency(feeBreakdown.other)}</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-stone-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-stone-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Sales Tax (collected)</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalSalesTax)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-900">
            {selectedIds.length} order{selectedIds.length !== 1 ? "s" : ""} selected
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input
          placeholder="Search by order ID or buyer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {etsyOrders.length === 0 && !ordersLoading ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders imported"
          description="Import your Etsy Sold Orders CSV to view them here."
          actionLabel="Import Orders"
          onAction={() => setImportDialogOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredOrders}
          isLoading={ordersLoading}
          emptyMessage="No orders match your filters"
        />
      )}

      <UnifiedEtsyStatementImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      </div>
      );
      }