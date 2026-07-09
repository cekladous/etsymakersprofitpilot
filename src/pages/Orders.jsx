import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeatureAccess } from "@/components/shared/useFeatureAccess";
import { Button } from "@/components/ui/button";
import UpgradeCTA from "@/components/subscriptions/UpgradeCTA";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Upload, Search, Download, ShoppingBag, DollarSign, CreditCard, Trash2, Calendar, Info, Loader2, Plus, Copy } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import UnifiedEtsyImportHub from "@/components/imports/UnifiedEtsyImportHub";
import DeleteAllDataDialog from "@/components/orders/DeleteAllDataDialog";
import OrderDetailSheet from "@/components/orders/OrderDetailSheet";
import FeeBreakdownChart from "@/components/orders/FeeBreakdownChart";
import ReconciliationTab from "@/components/etsy/ReconciliationTab";
import { calculateNetEarnings, calculateTotalNetEarnings, findOrderFee } from "@/components/shared/netEarnings";
import ChannelBadge from "@/components/orders/ChannelBadge";
import { isSquareInPersonOrder } from "@/components/shared/channelUtils";

export default function Orders() {
  const { user, loading } = useAuth();
  const { canExportCSV } = useFeatureAccess();
  const urlParams = new URLSearchParams(window.location.search);
  const customerFilter = urlParams.get("customer");
  const tabParam = urlParams.get("tab");
  const initialTab = tabParam === "fees" ? "fees_deposits" : tabParam || "orders";
  
  const [activeTab, setActiveTab] = useState(initialTab);
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
  const [showExportUpgrade, setShowExportUpgrade] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({ date: new Date().toISOString().split("T")[0], amount: "", notes: "" });

  const queryClient = useQueryClient();

  const { data: etsyOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["etsy-orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyOrder.filter({
      owner_user_id: user.id,
    }, "-sale_date", 1000),
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.OrderFee.filter({
      owner_user_id: user.id,
    }, "-created_date", 1000),
  });

  const { data: etsyLedgerEntries = [] } = useQuery({
    queryKey: ["etsy-ledger-entries", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyLedgerEntry.filter({
      owner_user_id: user.id,
    }, "-entry_date", 10000),
  });

  const { data: fees = [], isLoading: feesLoading } = useQuery({
    queryKey: ["fees", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Fee.filter({
      owner_user_id: user.id,
    }, "-transaction_date", 5000),
  });

  const { data: statementLines = [] } = useQuery({
    queryKey: ["statement-lines-orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementLine.filter({
      owner_user_id: user.id,
    }, "-transaction_date", 10000),
  });

  const { data: etsyStatementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementImport.filter({
      owner_user_id: user.id,
    }, "-imported_at"),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Transfer.filter({
      owner_user_id: user.id,
    }, "-date", 1000),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      console.log('Starting bulk delete for', ids.length, 'orders');
      
      // Get the order_id strings for the selected entity IDs
      const ordersToDelete = etsyOrders.filter(o => ids.includes(o.id));
      const orderIdStrings = ordersToDelete.map(o => o.order_id);
      
      console.log('Order IDs to delete:', orderIdStrings);
      
      // Delete associated fees first
      const feesToDelete = fees.filter(f => orderIdStrings.includes(f.order_id));
      console.log('Deleting', feesToDelete.length, 'fees');
      for (const fee of feesToDelete) {
        await base44.entities.Fee.delete(fee.id);
      }
      
      // Delete order fees
      const orderFeesToDelete = orderFees.filter(f => orderIdStrings.includes(f.order_id));
      console.log('Deleting', orderFeesToDelete.length, 'order fees');
      for (const orderFee of orderFeesToDelete) {
        await base44.entities.OrderFee.delete(orderFee.id);
      }
      
      // Then delete orders
      console.log('Deleting', ids.length, 'orders');
      for (const id of ids) {
        await base44.entities.EtsyOrder.delete(id);
      }
      
      console.log('Bulk delete complete');
    },
    onSuccess: () => {
      console.log('Bulk delete succeeded, refreshing data');
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      setSelectedIds([]);
    },
    onError: (error) => {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete orders: ' + error.message);
    },
  });

  const bulkDeleteFeesMutation = useMutation({
    mutationFn: async (ids) => {
      const feesToDelete = fees.filter(f => ids.includes(f.id));
      for (const fee of feesToDelete) {
        const lines = await base44.entities.EtsyStatementLine.filter({
          line_uid: fee.line_uid,
          owner_user_id: user.id
        });
        for (const line of lines) {
          await base44.entities.EtsyStatementLine.delete(line.id);
        }
      }
      await Promise.all(ids.map(id => base44.entities.Fee.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-lines"] });
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

  const addDepositMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Transfer.create({
        owner_user_id: user.id,
        type: "etsy_deposit",
        date: data.date,
        amount: parseFloat(data.amount) || 0,
        notes: data.notes || "Etsy Deposit",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      setDepositDialogOpen(false);
      setDepositForm({ date: new Date().toISOString().split("T")[0], amount: "", notes: "" });
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
      
      let matchesCustomer = true;
      if (customerFilter) {
        matchesCustomer = order.buyer_full_name === customerFilter;
      }
      
      return matchesSearch && matchesDate && matchesCustomer;
    });
  }, [etsyOrders, search, dateRange, customerFilter]);

  // Etsy-only orders: excludes Square/in-person orders (which Etsy's Activity
  // Summary never includes). Used for all Etsy-only KPIs. Square orders remain
  // in filteredOrders for the table and Total Business view.
  const etsyOnlyOrders = useMemo(
    () => filteredOrders.filter(o => !isSquareInPersonOrder(o)),
    [filteredOrders]
  );

  // Revenue (excl. tax) = Net Sales, matching Etsy's statement Sales figure.
  // Net Sales = (order_total - refunds) - sales_tax - CO Retail Delivery Fee
  const totalRevenue = etsyOnlyOrders.reduce((sum, o) => {
    const gross = (o.order_total || 0) - (o.refund_amount || 0);
    const tax = (o.sales_tax || 0);
    const expected = (o.order_value || 0) + (o.shipping_charged || 0) + tax - (o.discount_amount || 0);
    const coFee = Math.max(0, (o.order_total || 0) - expected);
    return sum + gross - tax - coFee;
  }, 0);

  // Shipping revenue (kept by seller)
  const totalShipping = etsyOnlyOrders.reduce((sum, o) => sum + (o.shipping_charged || 0), 0);
  // Discounts and refunds (used in internal profit view, matching Reconciliation tab)
  const totalDiscounts = etsyOnlyOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);
  const totalRefunds = etsyOnlyOrders.reduce((sum, o) => sum + (o.refund_amount || 0), 0);
  // Item revenue (order_value only, used in internal profit view formula)
  const totalItemRevenue = etsyOnlyOrders.reduce((sum, o) => sum + (o.order_value || 0), 0);

  // Unified fees: merge EtsyStatementLine fee records (authoritative source from
  // imports) with Fee entity records (secondary derivative). Dedup by composite key.
  // This ensures fees display correctly even when Fee entity creation fails during import.
  const activeFees = useMemo(() => {
    const statementFeeLines = statementLines
      .filter(l => l.category === 'fee')
      .map(l => ({
        id: l.id,
        transaction_date: l.transaction_date,
        order_id: l.order_id || '',
        fee_type: l.fee_type,
        amount: l.amount,
        description: l.description,
        import_id: l.import_id,
      }));

    const stmtKeys = new Set(
      statementFeeLines.map(f => `${f.transaction_date}|${f.order_id}|${f.fee_type}|${f.amount}`)
    );

    const feeEntityFees = fees
      .filter(fee => {
        if (!fee.import_id) return true;
        const feeImport = etsyStatementImports.find(imp => imp.id === fee.import_id);
        return !feeImport || feeImport.status !== 'replaced';
      })
      .filter(fee => {
        const key = `${fee.transaction_date}|${fee.order_id || ''}|${fee.fee_type}|${fee.amount}`;
        return !stmtKeys.has(key);
      });

    return [...statementFeeLines, ...feeEntityFees];
  }, [statementLines, fees, etsyStatementImports]);

  const relevantOrderFees = orderFees.filter(f => etsyOnlyOrders.some(o => o.order_id === f.order_id));
  // Period fees: ALL fees for the selected date range (independent of fee search/filter).
  const periodFees = useMemo(() => {
    if (!dateRange) return activeFees;
    return activeFees.filter(f => {
      const date = new Date(f.transaction_date);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [activeFees, dateRange]);

  // When search is active, scope statement lines to only the filtered orders
  // so KPI cards and reconciliation summary stay consistent with the table.
  const isSearchActive = !!(search && search.trim());
  const statementPeriodLines = useMemo(() => {
    let lines = statementLines;
    if (dateRange) {
      lines = lines.filter(l => {
        if (!l.transaction_date) return false;
        const d = new Date(l.transaction_date);
        return d >= dateRange.start && d <= dateRange.end;
      });
    }
    if (isSearchActive) {
      const etsyOnlyOrderIds = new Set(etsyOnlyOrders.map(o => o.order_id));
      lines = lines.filter(l => l.order_id && etsyOnlyOrderIds.has(l.order_id));
    }
    return lines;
  }, [statementLines, dateRange, isSearchActive, filteredOrders]);

  // Etsy Fees: all lines in the 'fees' section (listing, transaction, processing, share_save, other)
  // Marketing: all lines in the 'ads' section (etsy ads, offsite ads, Etsy Plus)
  // Split by section to match Etsy's official statement categories
  // Fees are stored as negative amounts, credits as positive amounts.
  // Negating the signed amount adds charges and subtracts credits — no Math.abs().
  const etsyFees = statementPeriodLines
    .filter(l => l.section === 'fees')
    .reduce((sum, l) => sum + (-(l.amount || 0)), 0);

  const marketingTotal = statementPeriodLines
    .filter(l => l.section === 'ads')
    .reduce((sum, l) => sum + Math.abs(l.amount || 0), 0);

  const shippingFeesTotal = statementPeriodLines
    .filter(l => l.section === 'shipping')
    .reduce((sum, l) => sum + Math.abs(l.amount || 0), 0);

  const totalFees = etsyFees + marketingTotal + shippingFeesTotal;
  // Fee breakdown: use OrderFee (per-order split) for listing/transaction/processing/share_save/other,
  // and statement lines for shop-level items (etsy_ads, offsite_ads, shipping, postage).
  const feeBreakdown = {
    listing: relevantOrderFees.reduce((s, f) => s + (f.listing_fees || 0), 0),
    transaction: relevantOrderFees.reduce((s, f) => s + (f.transaction_fees || 0), 0),
    processing: relevantOrderFees.reduce((s, f) => s + (f.processing_fees || 0), 0),
    etsy_ads: statementPeriodLines.filter(l => l.section === 'ads' && l.fee_type === "etsy_ads").reduce((s, l) => s + Math.abs(l.amount || 0), 0),
    offsite_ads: statementPeriodLines.filter(l => l.section === 'ads' && l.fee_type === "offsite_ads").reduce((s, l) => s + Math.abs(l.amount || 0), 0),
    shipping: statementPeriodLines.filter(l => l.section === 'shipping' && l.fee_type === "shipping_label").reduce((s, l) => s + Math.abs(l.amount || 0), 0),
    other_postage: statementPeriodLines.filter(l => l.section === 'shipping' && l.fee_type === "other_postage").reduce((s, l) => s + Math.abs(l.amount || 0), 0),
    share_save: relevantOrderFees.reduce((s, f) => s + (f.share_save_credit || 0), 0),
    other: relevantOrderFees.reduce((s, f) => s + (f.other_fees || 0), 0)
      + statementPeriodLines.filter(l => l.section === 'ads' && !["etsy_ads","offsite_ads"].includes(l.fee_type)).reduce((s, l) => s + Math.abs(l.amount || 0), 0),
  };

  // Total Net Earnings (internal profit): item revenue + shipping - discounts - refunds - Etsy Fees - Marketing
  // Matches the Reconciliation tab's "Internal Profit View" exactly
  const totalNetEarnings = totalItemRevenue + totalShipping - totalDiscounts - totalRefunds - etsyFees - marketingTotal;
  
  // Sum of per-order profits (Order Profit column) — each order's net after
  // transaction + processing fees + Share & Save credit, but before shop-level costs.
  const sumOfOrderProfits = etsyOnlyOrders.reduce((sum, o) => {
    const fees = findOrderFee(orderFees, o.order_id);
    return sum + calculateNetEarnings(o, fees);
  }, 0);
  // Shop-level costs bridge the gap between sum-of-order-profits and totalNetEarnings:
  // listing fees, Etsy Ads, Offsite Ads, other shop fees not tied to individual orders.
  const shopLevelCosts = sumOfOrderProfits - totalNetEarnings;

  const totalSalesTax = etsyOnlyOrders.reduce((sum, o) => sum + (o.sales_tax || 0), 0);

  // Total Business view: all orders including Square/in-person
  const totalBusinessRevenue = filteredOrders.reduce((sum, o) => {
    const gross = (o.order_total || 0) - (o.refund_amount || 0);
    const tax = (o.sales_tax || 0);
    const expected = (o.order_value || 0) + (o.shipping_charged || 0) + tax - (o.discount_amount || 0);
    const coFee = Math.max(0, (o.order_total || 0) - expected);
    return sum + gross - tax - coFee;
  }, 0);
  const squareOrderCount = filteredOrders.length - etsyOnlyOrders.length;

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

  // Share & Save credits reduce total fees, not increase them
  const totalAllFees = filteredFees.reduce((sum, f) => {
    const amt = f.amount || 0;
    return sum + (f.fee_type === 'share_save_credit' ? -Math.abs(amt) : Math.abs(amt));
  }, 0);
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
    let label = timeRange === "all" ? "All Orders" : "";
    if (customStartDate && customEndDate) {
      label = `${format(customStartDate, "MMM d, yyyy")} - ${format(customEndDate, "MMM d, yyyy")}`;
    } else if (timeRange === "month") {
      label = format(selectedDate, "MMMM yyyy");
    } else if (timeRange === "quarter") {
      const quarter = Math.floor(selectedDate.getMonth() / 3) + 1;
      label = `Q${quarter} ${format(selectedDate, "yyyy")}`;
    } else if (timeRange === "year") {
      label = format(selectedDate, "yyyy");
    }
    
    if (customerFilter) {
      label = `${label} - ${customerFilter}`;
    }
    return label || "All Orders";
  };

  const exportOrders = () => {
    if (!canExportCSV()) {
      setShowExportUpgrade(true);
      return;
    }

    const csv = [
      ["Order ID", "Date", "Buyer", "Items", "Order Value", "Shipping", "Sales Tax", "Total Fees", "Net"],
      ...filteredOrders.map(o => {
        const fees = findOrderFee(orderFees, o.order_id);
        const netEarnings = calculateNetEarnings(o, fees);
        return [
          o.order_id,
          o.sale_date,
          o.buyer_username,
          o.number_of_items,
          o.order_value,
          o.shipping_charged,
          o.sales_tax,
          fees?.total_fees || 0,
          netEarnings
        ];
      })
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etsy-orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
      render: (row) => {
        const isCredit = row.fee_type === 'share_save_credit' || row.amount < 0;
        return (
          <span className={`font-semibold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isCredit ? '+' : '-'}{formatCurrency(Math.abs(row.amount || 0))}
          </span>
        );
      },
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
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      header: "Order #",
      render: (row) => (
        <button
          onClick={() => setSelectedIds([row.id])}
          className="font-medium text-blue-600 hover:underline"
        >
          #{row.order_id}
        </button>
      ),
    },
    {
      header: "Date",
      render: (row) => (
        <span className="text-sm text-stone-600">
          {row.sale_date ? format(new Date(row.sale_date), "MMM d, yyyy") : "—"}
        </span>
      ),
    },
    {
      header: "Buyer",
      render: (row) => (
        <div className="max-w-48">
          <p className="font-medium text-stone-900 truncate">{row.buyer_username || row.buyer_full_name || "-"}</p>
          <p className="text-sm text-stone-500">{row.number_of_items || 0} item(s)</p>
        </div>
      ),
    },
    {
      header: "Item Total",
      render: (row) => (
        <span className="font-medium text-stone-900">
          {formatCurrency(row.order_value || 0)}
        </span>
      ),
    },
    {
      header: "Fees",
      render: (row) => {
        const fees = findOrderFee(orderFees, row.order_id);
        if (!fees || fees.total_fees === 0) {
          return <span className="text-stone-400">—</span>;
        }
        
        const feeItems = [
          { label: "Listing", value: fees.listing_fees, isCredit: false },
          { label: "Transaction", value: fees.transaction_fees, isCredit: false },
          { label: "Processing", value: fees.processing_fees, isCredit: false },
          { label: "Etsy Ads", value: fees.etsy_ads, isCredit: false },
          { label: "Offsite Ads", value: fees.offsite_ads_fees, isCredit: false },
          { label: "Shipping Label", value: fees.etsy_shipping, isCredit: false },
          { label: "Other Postage", value: fees.other_postage_costs, isCredit: false },
          { label: "Share & Save Credit", value: fees.share_save_credit, isCredit: true },
          { label: "Other", value: fees.other_fees, isCredit: false },
        ].filter(item => item.value > 0);

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <span className="text-rose-600 font-medium">
                    -{formatCurrency(fees.total_fees)}
                  </span>
                  <Info className="w-3 h-3 text-stone-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-xs mb-2">Fee Breakdown</p>
                  {feeItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between gap-4 text-xs">
                      <span className="text-stone-600">{item.label}:</span>
                      <span className={`font-medium ${item.isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                        {item.isCredit ? "+" : "-"}{formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-1 mt-2 flex justify-between gap-4 text-xs font-semibold">
                    <span>Total:</span>
                    <span className="text-rose-600">-{formatCurrency(fees.total_fees)}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      header: "Order Profit",
      render: (row) => {
        const fees = findOrderFee(orderFees, row.order_id);
        const netEarnings = calculateNetEarnings(row, fees);
        return (
          <span className="font-semibold text-emerald-600">
            {formatCurrency(netEarnings)}
          </span>
        );
      },
    },
    {
      header: "Status",
      render: (row) => {
        // Detect fully refunded/canceled orders: refund covers the pre-tax sale amount
        const refund = row.refund_amount || 0;
        const preTaxTotal = (row.order_total || 0) - (row.sales_tax || 0);
        const isCanceled = refund > 0 && refund >= preTaxTotal - 0.01;
        const status = isCanceled ? "Canceled" : (row.status || "completed");
        return (
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              status === "Canceled" ? "bg-rose-100 text-rose-700" :
              status === "shipped" ? "bg-blue-100 text-blue-700" :
              status === "completed" ? "bg-emerald-100 text-emerald-700" :
              status === "in_production" ? "bg-amber-100 text-amber-700" :
              "bg-stone-100 text-stone-600"
            }`}>
              {status}
            </span>
            <ChannelBadge order={row} />
          </div>
        );
      },
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
          {etsyOrders.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-300 hover:bg-rose-50"
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Data
            </Button>
          )}
        </div>
      </PageHeader>


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="fees_deposits">Fees & Deposits</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          </TabsList>
          {etsyOrders.filter(o => o.possible_duplicate).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("duplicates")}
              className="text-amber-600 hover:text-amber-700"
            >
              <Copy className="w-4 h-4 mr-1" />
              {etsyOrders.filter(o => o.possible_duplicate).length} Duplicates
            </Button>
          )}
        </div>

        <TabsContent value="orders" className="space-y-6">
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
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </>
                )}
              </Button>
            </div>
          )}

                {/* Info: Internal profit view */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
            <p className="text-xs text-blue-800">
              <strong>Etsy-only KPIs:</strong> Revenue, Order Count, Fees, and Net Earnings exclude in-person Square sales (which Etsy's Activity Summary never includes). Square orders remain visible in the table below.
            </p>
            {squareOrderCount > 0 && (
              <p className="text-xs text-blue-600">
                <strong>Total Business Revenue (all channels):</strong> {formatCurrency(totalBusinessRevenue)} across {filteredOrders.length} orders ({squareOrderCount} in-person/Square).
              </p>
            )}
            <p className="text-xs text-blue-800">
              Revenue excludes sales tax. Etsy Fees and Marketing are shown separately to match Etsy's statement categories. For Etsy statement reconciliation, see the Reconciliation tab.
            </p>
          </div>

          {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card
          onClick={() => {
            const el = document.getElementById('orders-table-section');
            if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
          }}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Etsy Orders</p>
                <p className="text-2xl font-bold text-stone-900">
                  {etsyOnlyOrders.length}
                </p>
                {squareOrderCount > 0 && (
                  <p className="text-xs text-stone-400">+{squareOrderCount} in-person</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("reconciliation")}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
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

        <Card
          onClick={() => setActiveTab("fees_deposits")}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500 flex items-center gap-1">
                  Etsy Fees
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex cursor-help">
                          <Info className="w-3 h-3 text-stone-400" />
                        </span>
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
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="flex justify-between gap-4 text-xs font-semibold">
                        <span>Etsy Fees:</span>
                        <span>{formatCurrency(etsyFees)}</span>
                      </div>
                      {marketingTotal > 0 && (
                        <div className="flex justify-between gap-4 text-xs font-semibold">
                          <span>Marketing:</span>
                          <span>{formatCurrency(marketingTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 text-xs font-semibold border-t pt-1">
                        <span>Total Charges:</span>
                        <span>{formatCurrency(totalFees)}</span>
                      </div>
                    </div>
                  </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(etsyFees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("fees_deposits")}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Marketing</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(marketingTotal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("reconciliation")}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Etsy Net Earnings</p>
                <p className="text-xs text-stone-400">Etsy-only profit (excludes non-Etsy expenses)</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalNetEarnings)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



          {/* Missing buyer info note */}
          {etsyOrders.length > 0 && etsyOrders.some(o => !o.buyer_username && !o.buyer_full_name) && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Buyer & item details not available</p>
                <p>
                  The Etsy Monthly Statement doesn't include buyer names or item counts. Upload the optional{" "}
                  <button
                    onClick={() => setImportDialogOpen(true)}
                    className="font-semibold text-blue-700 underline hover:text-blue-900"
                  >
                    Sold Orders Report
                  </button>{" "}
                  to populate buyer names and item counts for these orders.
                </p>
              </div>
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
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-8 text-center">
              <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-4">
                <ShoppingBag className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-stone-900">No Etsy sales yet</h3>
              <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto">
                Import your Etsy Monthly Statement CSV to populate your sales data, fees, and deposits.
              </p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 mt-5"
                size="lg"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="w-5 h-5 mr-2" />
                Import Your First Etsy Statement
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredOrders}
              isLoading={ordersLoading}
              emptyMessage="No orders match your filters"
            />
          )}

          {/* Reconciliation summary: bridges per-order profit and shop-level net earnings */}
          {filteredOrders.length > 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              {isSearchActive ? (
                <p className="text-sm text-stone-700">
                  <span className="font-medium">Search filter active.</span>{" "}
                  Showing results for {filteredOrders.length} matching order(s) only.
                  Shop-level costs (listing fees, Etsy Ads, subscription) are scoped to these orders — clear the search to see the full shop-wide reconciliation.
                </p>
              ) : (
                <>
                  <p className="text-sm text-stone-700">
                    <span className="font-medium">Sum of order profits</span>{" "}
                    <span className="font-semibold text-emerald-700">{formatCurrency(sumOfOrderProfits)}</span>
                    {" — minus "}
                    <span className="font-medium">shop-level costs</span>{" "}
                    <span className="text-stone-500">(listing fees, Etsy Ads, subscription)</span>{" "}
                    <span className="font-semibold text-rose-600">{formatCurrency(shopLevelCosts)}</span>
                    {" = "}
                    <span className="font-medium">Etsy Net Earnings</span>{" "}
                    <span className="font-semibold text-stone-900">{formatCurrency(totalNetEarnings)}</span>
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    Per-order profit deducts transaction and processing fees only. Shop-level costs (listing fees, advertising, and subscriptions) are deducted here to arrive at total Etsy Net Earnings. This is Etsy-only profit (excludes in-person Square sales) — see the Dashboard for Total Business Net Profit (includes non-Etsy expenses).
                  </p>
                </>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fees_deposits" className="space-y-6">
           {/* About Section */}
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
             <h3 className="font-semibold text-blue-900 mb-2">About Fees & Charges</h3>
             <p className="text-sm text-blue-800">
               This tab shows all individual fee line items from your Etsy statement imports, including order-specific fees (transaction, processing, ads) and general shop charges not tied to specific orders. The "Orders" tab shows only fees directly associated with each sale.
             </p>
           </div>

           {/* Charts */}
           <FeeBreakdownChart feeBreakdown={feeBreakdown} formatCurrency={formatCurrency} />

           {/* Fee Breakdown by Category — sourced from EtsyStatementLine (authoritative, matches Reconciliation tab) */}
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
             {[
               { label: "Listing Fees", value: feeBreakdown.listing },
               { label: "Transaction Fees", value: feeBreakdown.transaction },
               { label: "Processing Fees", value: feeBreakdown.processing },
               { label: "Etsy Ads", value: feeBreakdown.etsy_ads },
               { label: "Share & Save Credits", value: feeBreakdown.share_save, isCredit: true },
               { label: "Other Fees", value: feeBreakdown.other },
             ].map((item, idx) => (
               <Card key={idx}>
                 <CardContent className="p-4">
                   <p className="text-xs text-stone-500">{item.label}</p>
                   <p className={`text-lg font-bold ${item.isCredit ? "text-emerald-600" : "text-stone-900"}`}>
                     {item.isCredit ? "+" : ""}{formatCurrency(item.value)}
                   </p>
                 </CardContent>
               </Card>
             ))}
           </div>

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
                     {formatCurrency(totalFees)}
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
          {activeFees.length === 0 && !feesLoading ? (
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
          {/* Deposits / Payouts Section */}
          <div className="border-t border-stone-200 pt-6 mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">Deposits / Payouts</h3>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setDepositDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Deposit
              </Button>
            </div>

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
             </div>
             </TabsContent>

             <TabsContent value="reconciliation" className="space-y-6">
           <ReconciliationTab user={user} />
         </TabsContent>
         <TabsContent value="duplicates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Possible Duplicate Orders</CardTitle>
                <CardDescription>
                  These orders have been flagged as possible duplicates based on matching date and total amount from different import sources (e.g. Etsy and Square). Review and delete any duplicates to ensure accurate reporting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={etsyOrders.filter(o => o.possible_duplicate)}
                  isLoading={ordersLoading}
                  emptyMessage="No duplicate orders found."
                />
              </CardContent>
            </Card>
          </TabsContent>
      </Tabs>

      <UnifiedEtsyImportHub
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <DeleteAllDataDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
      />

      <OrderDetailSheet 
        order={filteredOrders.find(o => selectedIds[0] && o.id === selectedIds[0])}
      orderFees={findOrderFee(orderFees, filteredOrders.find(o => selectedIds[0] && o.id === selectedIds[0])?.order_id)}
        open={selectedIds.length === 1 && !bulkDeleteMutation.isPending}
        onOpenChange={() => setSelectedIds([])}
      />

      {showExportUpgrade && (
        <UpgradeCTA
          feature="CSV exports"
          onClose={() => setShowExportUpgrade(false)}
        />
      )}

      {/* Add Deposit Dialog */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Etsy Deposit / Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Deposit Date *</Label>
              <Input
                type="date"
                value={depositForm.date}
                onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Amount ($) *</Label>
              <Input
                type="number"
                step="0.01"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Input
                value={depositForm.notes}
                onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                placeholder="Etsy Deposit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!depositForm.amount || addDepositMutation.isPending}
              onClick={() => addDepositMutation.mutate(depositForm)}
            >
              {addDepositMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}