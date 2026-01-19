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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import UnifiedEtsyImportHub from "@/components/imports/UnifiedEtsyImportHub";
import OrderDetailSheet from "@/components/orders/OrderDetailSheet";

export default function Orders() {
  const [activeTab, setActiveTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [feeSearch, setFeeSearch] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState([]);
  const [selectedDepositIds, setSelectedDepositIds] = useState([]);
  const [selectedFeeOrderId, setSelectedFeeOrderId] = useState(null);

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

  const { data: fees = [], isLoading: feesLoading } = useQuery({
    queryKey: ["fees"],
    queryFn: () => base44.entities.Fee.list("-transaction_date", 5000),
  });

  const { data: etsyStatementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports"],
    queryFn: () => base44.entities.EtsyStatementImport.list("-imported_at"),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => base44.entities.Transfer.list("-date", 1000),
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

  const bulkDeleteFeesMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.Fee.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      setSelectedFeeIds([]);
    },
  });

  const bulkDeleteDepositsMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.Transfer.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      setSelectedDepositIds([]);
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
  const relevantOrderFees = orderFees.filter(f => filteredOrders.some(o => o.order_id === f.order_id));
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

  // Filter fees from active imports only
  const activeFees = useMemo(() => {
    return fees.filter(fee => {
      if (!fee.import_id) return true;
      const feeImport = etsyStatementImports.find(imp => imp.id === fee.import_id);
      return !feeImport || feeImport.status !== 'replaced';
    });
  }, [fees, etsyStatementImports]);

  const filteredFees = useMemo(() => {
    let filtered = activeFees;

    if (timeRange !== "all" && dateRange) {
      filtered = filtered.filter(f => {
        const date = new Date(f.transaction_date);
        return date >= dateRange.start && date <= dateRange.end;
      });
    }

    return filtered.filter(fee => {
      const matchesSearch = !feeSearch || 
        fee.description?.toLowerCase().includes(feeSearch.toLowerCase()) ||
        fee.order_id?.toLowerCase().includes(feeSearch.toLowerCase());
      
      const matchesType = feeTypeFilter === "all" || fee.fee_type === feeTypeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [activeFees, feeSearch, feeTypeFilter, dateRange, timeRange]);

  const etsyDeposits = useMemo(() => {
    let deposits = transfers.filter(t => t.type === "etsy_deposit");

    if (timeRange !== "all" && dateRange) {
      deposits = deposits.filter(d => {
        const date = new Date(d.date);
        return date >= dateRange.start && date <= dateRange.end;
      });
    }

    return deposits;
  }, [transfers, dateRange, timeRange]);

  const totalAllFees = filteredFees.reduce((sum, f) => sum + Math.abs(f.amount || 0), 0);
  const totalDeposits = etsyDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);

  const feeTypeLabels = {
    listing: "Listing Fee",
    transaction: "Transaction Fee",
    processing: "Processing Fee",
    share_save_credit: "Share & Save Credit",
    other_fee: "Other Fee",
    etsy_ads: "Etsy Ads",
    offsite_ads: "Offsite Ads",
    shipping_label: "Shipping Label",
    other_postage: "Other Postage",
  };

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
      const fees = orderFees.find(f => f.order_id === o.order_id);
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
    setSelectedIds([]);
  };

  const toggleSelect = (id) => {
    setSelectedIds([id]);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.length} order(s)? This will also delete associated fees.`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const toggleSelectAllFees = () => {
    if (selectedFeeIds.length === filteredFees.length) {
      setSelectedFeeIds([]);
    } else {
      setSelectedFeeIds(filteredFees.map(f => f.id));
    }
  };

  const toggleSelectFee = (id) => {
    setSelectedFeeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDeposits = () => {
    if (selectedDepositIds.length === etsyDeposits.length) {
      setSelectedDepositIds([]);
    } else {
      setSelectedDepositIds(etsyDeposits.map(d => d.id));
    }
  };

  const toggleSelectDeposit = (id) => {
    setSelectedDepositIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteFees = () => {
    if (window.confirm(`Delete ${selectedFeeIds.length} fee(s)?`)) {
      bulkDeleteFeesMutation.mutate(selectedFeeIds);
    }
  };

  const handleBulkDeleteDeposits = () => {
    if (window.confirm(`Delete ${selectedDepositIds.length} deposit(s)?`)) {
      bulkDeleteDepositsMutation.mutate(selectedDepositIds);
    }
  };

  const feeColumns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedFeeIds.length === filteredFees.length && filteredFees.length > 0}
          onChange={toggleSelectAllFees}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedFeeIds.includes(row.id)}
          onChange={() => toggleSelectFee(row.id)}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
    },
    {
      header: "Date",
      render: (row) => row.transaction_date || "—",
    },
    {
          header: "Order ID",
          render: (row) => (
            <div className="max-w-32 truncate">
              {row.order_id ? (
                <button
                  onClick={() => {
                    const order = etsyOrders.find(o => o.order_id === row.order_id);
                    if (order) {
                      setSelectedIds([order.id]);
                    }
                  }}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  #{row.order_id}
                </button>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </div>
          ),
        },
    {
      header: "Fee Type",
      render: (row) => (
        <span className="text-sm">
          {feeTypeLabels[row.fee_type] || row.fee_type}
        </span>
      ),
    },
    {
      header: "Description",
      render: (row) => (
        <div className="max-w-xs truncate text-stone-600 text-sm">
          {row.description || "—"}
        </div>
      ),
    },
    {
      header: "Shipping",
      render: (row) => {
        const order = etsyOrders.find(o => o.order_id === row.order_id);
        return (
          <span className="text-stone-600">
            {order ? formatCurrency(order.shipping_charged || 0) : "—"}
          </span>
        );
      },
    },
    {
      header: "Amount",
      render: (row) => (
        <span className={`font-semibold ${row.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {formatCurrency(Math.abs(row.amount || 0))}
        </span>
      ),
    },
    ];

  const depositColumns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedDepositIds.length === etsyDeposits.length && etsyDeposits.length > 0}
          onChange={toggleSelectAllDeposits}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedDepositIds.includes(row.id)}
          onChange={() => toggleSelectDeposit(row.id)}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
    },
    {
      header: "Date",
      render: (row) => row.date || "—",
    },
    {
      header: "Description",
      render: (row) => (
        <div className="text-stone-600">
          {row.notes || "Etsy Deposit"}
        </div>
      ),
    },
    {
      header: "Amount",
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {formatCurrency(row.amount || 0)}
        </span>
      ),
    },
  ];

  const columns = [
    {
      header: "Order ID",
      render: (row) => (
        <div>
          <button
            onClick={() => setSelectedIds([row.id])}
            className="font-medium text-blue-600 hover:underline"
          >
            #{row.order_id}
          </button>
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
        const fees = orderFees.find(f => f.order_id === row.order_id);
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
      <PageHeader title="Etsy" description={getPeriodLabel()}>
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
            Import Etsy Data
          </Button>
        </div>
      </PageHeader>

      {/* Helper Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 mb-2">
          <strong>📊 Import Your Etsy Data:</strong>
        </p>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-900">
          <div>
            <p className="font-semibold mb-1">Monthly Statement (Required)</p>
            <p className="text-xs">Finances → Payment Account → Download CSV</p>
            <p className="text-xs opacity-75">Contains all financial data, fees, deposits</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Sold Orders Report (Optional)</p>
            <p className="text-xs">Shop Manager → Orders → Download CSV</p>
            <p className="text-xs opacity-75">Adds product details, SKUs, buyer info</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="fees">Fees & Charges</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
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
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Net After Fees</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalRevenue - totalFees)}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {totalRevenue > 0 ? ((((totalRevenue - totalFees) / totalRevenue) * 100).toFixed(1)) : 0}% of revenue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



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
              description="Import your Etsy Monthly Statement to view orders here."
              actionLabel="Import Statement"
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
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 rounded-lg">
                  <CreditCard className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">Total Fees & Charges</p>
                  <p className="text-2xl font-bold text-stone-900">
                    {formatCurrency(totalAllFees)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectedFeeIds.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm font-medium text-emerald-900">
                {selectedFeeIds.length} fee{selectedFeeIds.length !== 1 ? "s" : ""} selected
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteFees}
                disabled={bulkDeleteFeesMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Search by order ID or description..."
                value={feeSearch}
                onChange={(e) => setFeeSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={feeTypeFilter} onValueChange={setFeeTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Fee Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fee Types</SelectItem>
                {Object.keys(feeTypeLabels).map((type) => (
                  <SelectItem key={type} value={type}>
                    {feeTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {fees.length === 0 && !feesLoading ? (
            <EmptyState
              icon={CreditCard}
              title="No fees imported"
              description="Import an Etsy Monthly Statement to view fees, ads, and shipping charges."
              actionLabel="Import Statement"
              onAction={() => setImportDialogOpen(true)}
            />
          ) : (
            <DataTable
              columns={feeColumns}
              data={filteredFees}
              isLoading={feesLoading}
              emptyMessage="No fees match your filters"
            />
          )}
        </TabsContent>

        <TabsContent value="deposits" className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">Total Deposits</p>
                  <p className="text-2xl font-bold text-stone-900">
                    {formatCurrency(totalDeposits)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectedDepositIds.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm font-medium text-emerald-900">
                {selectedDepositIds.length} deposit{selectedDepositIds.length !== 1 ? "s" : ""} selected
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteDeposits}
                disabled={bulkDeleteDepositsMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}

          {/* Table */}
          {etsyDeposits.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No deposits recorded"
              description="Deposits are tracked separately as cashflow, not revenue."
            />
          ) : (
            <DataTable
              columns={depositColumns}
              data={etsyDeposits}
              emptyMessage="No deposits for selected period"
            />
          )}
        </TabsContent>
      </Tabs>

      <UnifiedEtsyImportHub
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <OrderDetailSheet 
        order={filteredOrders.find(o => selectedIds[0] && o.id === selectedIds[0])}
        orderFees={orderFees.find(f => filteredOrders.find(o => selectedIds[0] && o.id === selectedIds[0])?.order_id === f.order_id)}
        open={selectedIds.length === 1 && !bulkDeleteMutation.isPending}
        onOpenChange={() => setSelectedIds([])}
      />
    </div>
  );
}