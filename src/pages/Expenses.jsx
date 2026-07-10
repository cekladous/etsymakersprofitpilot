import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeatureAccess } from "@/components/shared/useFeatureAccess";
import { Button } from "@/components/ui/button";
import UpgradeCTA from "@/components/subscriptions/UpgradeCTA";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Upload, Search, MoreHorizontal, Receipt, Trash2, Download, PieChart as PieChartIcon, Calendar, X, Filter, RefreshCw, CopyCheck, ArrowUp, ArrowDown, ChevronsUpDown, Copy } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, parse } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import CSVImporter from "@/components/shared/CSVImporter";
import ChasePDFImport from "@/components/expenses/ChasePDFImport";
import DuplicateReviewDialog, { findDuplicateGroups } from "@/components/expenses/DuplicateReviewDialog";
import ExpenseFormDialog from "@/components/expenses/ExpenseFormDialog";
import RefundConflictWarning from "@/components/reconciliation/RefundConflictWarning";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { calculateTotalExpenses } from "@/components/shared/expenseCalculator";
import { useToast } from "@/components/ui/use-toast";

import { BUSINESS_EXPENSE_CATEGORIES, ETSY_FEE_CATEGORIES, CATEGORY_COLORS as categoryColors } from "@/components/shared/expenseCategories";

const CATEGORIES = [...BUSINESS_EXPENSE_CATEGORIES, ...ETSY_FEE_CATEGORIES];

export default function Expenses() {
  const { user, loading } = useAuth();
  const { canExportCSV } = useFeatureAccess();
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("table");
  const [selectedIds, setSelectedIds] = useState([]);
  const [timeRange, setTimeRange] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [materialFilter, setMaterialFilter] = useState("all");
  const [navSource, setNavSource] = useState(null);
  const [showExportUpgrade, setShowExportUpgrade] = useState(false);
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);

  const queryClient = useQueryClient();

  // Check URL params for filters and date range (runs once on mount)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Track navigation source
    const source = params.get("source") || null;
    setNavSource(source);
    
    // Handle category filter from URL
    const categoryParam = params.get("category");
    if (categoryParam) {
      setCategoryFilter(categoryParam);
    }
    
    // Handle uncategorized filter
    if (params.get("filter") === "uncategorized") {
      setStatusFilter("uncategorized");
    }
    
    // Handle date range from URL (from Dashboard/Net Profit/Actuals)
    const startDateParam = params.get("startDate");
    const endDateParam = params.get("endDate");
    const rangeParam = params.get("range");
    
    if (startDateParam && endDateParam) {
      setCustomStartDate(parse(startDateParam, 'yyyy-MM-dd', new Date()));
      setCustomEndDate(parse(endDateParam, 'yyyy-MM-dd', new Date()));
      setTimeRange(rangeParam || "custom");
    }
  }, []);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Expense.filter({ owner_user_id: user.id }, "-date"),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
  });

  const { data: etsyOrders = [] } = useQuery({
    queryKey: ["etsy-orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyOrder.filter({ owner_user_id: user.id }, "-sale_date", 1000),
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.OrderFee.filter({ owner_user_id: user.id }),
  });

  const { data: businessExpenses = [] } = useQuery({
    queryKey: ["business-expenses", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BusinessExpense.filter({ owner_user_id: user.id }, "-date", 1000),
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialPurchase.filter({ owner_user_id: user.id }, "-purchase_date", 1000),
  });

  const { data: etsyLedgerEntries = [] } = useQuery({
    queryKey: ["etsy-ledger-entries", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyLedgerEntry.filter({ owner_user_id: user.id }, "-entry_date", 5000),
  });

  const { data: etsyStatementLines = [] } = useQuery({
    queryKey: ["etsy-statement-lines", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementLine.filter({ owner_user_id: user.id }),
  });

  const { data: etsyStatementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementImport.filter({ owner_user_id: user.id }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.Expense.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSelectedIds([]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const handleImport = async (rows) => {
    let added = 0, updated = 0, skipped = 0;
    const skippedRecords = [];
    const appSettings = settings[0];
    const rules = appSettings?.auto_categorization_rules || [];

    for (const row of rows) {
      const parsed = parseExpenseRow(row);
      if (!parsed.amount || !parsed.date) {
        skipped++;
        skippedRecords.push({
          row,
          reason: !parsed.date ? "Missing date" : "Missing amount"
        });
        continue;
      }

      // Auto-categorize based on rules
      let category = "other";
      let isCategorized = false;
      const desc = (parsed.description || "").toLowerCase();
      
      for (const rule of rules) {
        if (desc.includes(rule.keyword.toLowerCase())) {
          category = rule.category;
          isCategorized = true;
          break;
        }
      }

      // Check for duplicates by transaction_id
      if (parsed.transaction_id) {
        const existing = expenses.find(e => e.transaction_id === parsed.transaction_id);
        if (existing) {
          skipped++;
          skippedRecords.push({
            row,
            reason: "Duplicate transaction ID"
          });
          continue;
        }
      }

      // Check for duplicates by date+amount+description
      const dedupeKey = `${parsed.date}|${Math.abs(parsed.amount).toFixed(2)}|${(parsed.description || '').substring(0, 40).trim().toLowerCase()}`;
      const existingByContent = expenses.find(e =>
        `${e.date}|${Math.abs(e.amount || 0).toFixed(2)}|${(e.description || '').substring(0, 40).trim().toLowerCase()}` === dedupeKey
      );
      if (existingByContent) {
        skipped++;
        skippedRecords.push({
          row,
          reason: "Duplicate (same date, amount, and description)"
        });
        continue;
      }

      await base44.entities.Expense.create({
        ...parsed,
        owner_user_id: user.id,
        category,
        is_categorized: isCategorized,
      });
      added++;
    }

    queryClient.invalidateQueries({ queryKey: ["expenses"] });

    toast({
      title: "Import Successful",
      description: `${added} of ${rows.length} transactions imported${skipped > 0 ? `, ${skipped} skipped` : ""}.`,
    });

    return { success: true, added, updated, skipped, skippedRecords };
  };

  const parseDateSafe = (dateStr) => {
    if (!dateStr) return null;
    const formats = ["MM/dd/yyyy", "yyyy-MM-dd", "MMM d, yyyy", "MMM dd, yyyy", "d-MMM-yyyy", "MM-dd-yyyy", "dd/MM/yyyy", "M/d/yyyy", "M/d/yy"];
    for (const fmt of formats) {
      try {
        const d = parse(dateStr, fmt, new Date());
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch (e) { /* try next format */ }
    }
    const native = new Date(dateStr);
    return (native instanceof Date && !isNaN(native.getTime())) ? native : null;
  };

  const parseExpenseRow = (row) => {
    const date = row["Date"] || row["Transaction Date"] || row["Posted Date"] || "";
    const parsedDate = parseDateSafe(date);
    const amountStr = row["Amount"] || row["Debit"] || row["Charge"] || row["Credit"] || "";
    const typeStr = (row["Type"] || "sale").toLowerCase();
    
    // Parse amount
    let amount = parseFloat(amountStr?.replace(/[^0-9.-]/g, "") || "0");
    
    // Determine transaction type
    let type = "sale";
    if (typeStr.includes("return") || typeStr.includes("refund") || typeStr.includes("credit")) {
      type = "return";
      amount = Math.abs(amount); // Returns are positive (credits)
    } else {
      // If there's a separate Credit column, treat it as a return
      if (row["Credit"] && !row["Debit"] && !row["Amount"]) {
        type = "return";
        amount = Math.abs(amount);
      } else {
        amount = Math.abs(amount); // Sales are positive debits
      }
    }
    
    return {
      transaction_id: row["Transaction ID"] || row["Reference"] || `${date}-${amountStr}`,
      date: parsedDate ? format(parsedDate, "yyyy-MM-dd") : "",
      description: row["Description"] || row["Merchant"] || row["Name"] || "",
      amount: amount,
      type: type,
      vendor: row["Vendor"] || row["Merchant"] || "",
      payment_method: row["Card"] || row["Account"] || "",
    };
  };

  const handleQuickCategory = (expense, category) => {
    updateMutation.mutate({
      id: expense.id,
      data: { category, is_categorized: true },
    });
  };

  const handleRemoveDuplicates = async () => {
    setDeduping(true);
    try {
      const allExpenses = await base44.entities.Expense.filter({ owner_user_id: user.id }, "-date");
      const allBusinessExpenses = await base44.entities.BusinessExpense.filter({ owner_user_id: user.id }, "-date", 1000);

      const expenseGroups = findDuplicateGroups(allExpenses).map(g => ({ ...g, _entity: "Expense" }));
      const businessGroups = findDuplicateGroups(allBusinessExpenses).map(g => ({ ...g, _entity: "BusinessExpense" }));

      const allGroups = [...expenseGroups, ...businessGroups];

      if (allGroups.length === 0) {
        toast({
          title: "No Duplicates Found",
          description: "Your expense records are already clean.",
        });
      } else {
        setDuplicateGroups(allGroups);
        setDuplicateDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to scan for duplicates: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setDeduping(false);
    }
  };

  const handleDeleteDuplicates = async (idsToDelete) => {
    setDeletingDuplicates(true);
    try {
      // Build a map of id -> entity type from the duplicate groups
      const idToEntity = {};
      duplicateGroups.forEach(g => {
        g.records.forEach(r => { idToEntity[r.id] = g._entity; });
      });

      // Group ids by entity type
      const expenseIds = idsToDelete.filter(id => idToEntity[id] === "Expense");
      const businessIds = idsToDelete.filter(id => idToEntity[id] === "BusinessExpense");

      const deleteBatch = async (ids, entityName) => {
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          await Promise.all(chunk.map(id => base44.entities[entityName].delete(id)));
        }
      };

      await deleteBatch(expenseIds, "Expense");
      await deleteBatch(businessIds, "BusinessExpense");

      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["business-expenses"] });

      toast({
        title: "Duplicates Deleted",
        description: `Removed ${idsToDelete.length} duplicate record(s).`,
      });

      // Remove deleted records from groups; close dialog if no more duplicates
      const remaining = duplicateGroups
        .map(g => ({ ...g, records: g.records.filter(r => !idsToDelete.includes(r.id)) }))
        .filter(g => g.records.length > 1);
      setDuplicateGroups(remaining);
      if (remaining.length === 0) {
        setDuplicateDialogOpen(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete duplicates: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setDeletingDuplicates(false);
    }
  };

  const handleMarkRecurring = async (records, frequency = "Monthly") => {
    setDeletingDuplicates(true);
    try {
      const entityName = duplicateGroups.find(g => g.records.some(r => r.id === records[0]?.id))?._entity;
      if (!entityName) return;

      for (let i = 0; i < records.length; i += 10) {
        const chunk = records.slice(i, i + 10);
        await Promise.all(chunk.map(r =>
          base44.entities[entityName].update(r.id, { is_recurring: true, recurring_frequency: frequency })
        ));
      }

      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["business-expenses"] });

      toast({
        title: "Marked as Recurring",
        description: `${records.length} record(s) marked as ${frequency} recurring. No records were deleted.`,
      });

      // Remove this group from the dialog
      setDuplicateGroups(prev => prev.filter(g => g.records[0]?.id !== records[0]?.id));
      if (duplicateGroups.length <= 1) {
        setDuplicateDialogOpen(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to mark as recurring: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setDeletingDuplicates(false);
    }
  };

  // Calculate date range
  const dateRange = useMemo(() => {
    if (timeRange === "all") {
      return null;
    }
    
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

  // Get unique materials for filter
  const uniqueMaterials = useMemo(() => {
    if (categoryFilter !== "materials_supplies") return [];
    
    const materials = new Set();
    
    // From MaterialPurchases
    materialPurchases.forEach(p => {
      if (p.material_name) materials.add(p.material_name);
    });
    
    // From BusinessExpenses
    businessExpenses
      .filter(e => e.category_name === "materials_supplies")
      .forEach(e => {
        if (e.vendor) materials.add(e.vendor);
      });
    
    return Array.from(materials).sort();
  }, [categoryFilter, materialPurchases, businessExpenses]);

  const filteredExpenses = useMemo(() => {
    // Combine all expense sources for unified view
    let allExpenses = [];
    
    // Legacy Expense entity
    allExpenses.push(...expenses.map(e => ({
      ...e,
      source: "legacy",
      material_name: e.vendor,
    })));
    
    // BusinessExpense entity
    allExpenses.push(...businessExpenses.map(e => ({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: e.amount,
      category: e.category_name,
      vendor: e.vendor,
      payment_method: e.payment_source,
      is_categorized: true,
      source: "business",
      material_name: e.vendor,
      is_recurring: e.is_recurring || false,
      recurring_frequency: e.recurring_frequency || null,
    })));
    
    // MaterialPurchase (treated as materials_supplies category)
    allExpenses.push(...materialPurchases.map(p => ({
      id: p.id,
      date: p.purchase_date,
      description: p.material_name,
      amount: p.total_cost,
      category: "materials_supplies",
      vendor: p.vendor,
      payment_method: p.payment_method,
      is_categorized: true,
      source: "material",
      material_name: p.material_name,
    })));
    
    // EtsyLedgerEntries (if matched to a category)
    allExpenses.push(...etsyLedgerEntries
      .filter(e => e.matched_category)
      .map(e => ({
        id: e.id,
        date: e.entry_date,
        description: `${e.title || ""} - ${e.info || ""}`,
        amount: Math.abs(e.net || 0),
        category: e.matched_category,
        vendor: "Etsy",
        payment_method: "Etsy Payment Ledger",
        is_categorized: true,
        source: "ledger",
      })));
    
    // Apply date range filter
    if (dateRange) {
      allExpenses = allExpenses.filter(expense => {
        if (!expense.date) return false;
        const expenseDate = new Date(expense.date);
        return expenseDate >= dateRange.start && expenseDate <= dateRange.end;
      });
    }
    
    // Deduplicate across sources (same date+description+amount = same transaction)
    const seen = new Set();
    allExpenses = allExpenses.filter(expense => {
      const key = `${expense.date}|${(expense.description || '').toLowerCase().trim()}|${expense.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Apply filters
    const filtered = allExpenses.filter(expense => {
      const matchesSearch = !search ||
        expense.description?.toLowerCase().includes(search.toLowerCase()) ||
        expense.vendor?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "uncategorized" && !expense.is_categorized) ||
        (statusFilter === "categorized" && expense.is_categorized);
      const matchesMaterial = materialFilter === "all" || 
        !expense.material_name ||
        expense.material_name === materialFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesMaterial;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case "date":
          valA = a.date ? new Date(a.date).getTime() : 0;
          valB = b.date ? new Date(b.date).getTime() : 0;
          break;
        case "amount":
          valA = a.amount || 0;
          valB = b.amount || 0;
          break;
        case "description":
          valA = (a.description || "").toLowerCase();
          valB = (b.description || "").toLowerCase();
          break;
        case "category":
          valA = (a.category || "").toLowerCase();
          valB = (b.category || "").toLowerCase();
          break;
        case "status":
          valA = a.is_categorized ? 1 : 0;
          valB = b.is_categorized ? 1 : 0;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [expenses, businessExpenses, materialPurchases, etsyLedgerEntries, search, categoryFilter, statusFilter, materialFilter, dateRange, sortField, sortDirection]);

  // Calculate totals directly from filtered table data (single source of truth)
  const totals = useMemo(() => {
    // Always calculate from the actual filtered expenses shown in the table
    const totalAmount = filteredExpenses.reduce((sum, e) => {
      const amount = e.amount || 0;
      return e.type === "return" ? sum - amount : sum + amount;
    }, 0);
    const totalDebits = filteredExpenses.reduce((sum, e) => e.type !== "return" ? sum + (e.amount || 0) : sum, 0);
    const totalCredits = filteredExpenses.reduce((sum, e) => e.type === "return" ? sum + (e.amount || 0) : sum, 0);
    
    // For date-filtered views, also calculate Dashboard-compatible breakdown
    let dashboardBreakdown = { orderFees: 0, businessExpenses: totalAmount, feeCredits: 0 };
    
    if (dateRange) {
      // Use shared calculator for Dashboard reconciliation
      const calculated = calculateTotalExpenses({
        etsyOrders,
        orderFees,
        businessExpenses,
        expenses, // Include all expense entities for reconciliation
        dateRange,
      });
      dashboardBreakdown = {
        orderFees: calculated.orderFees,
        businessExpenses: calculated.businessExpenses,
        feeCredits: calculated.feeCredits,
        legacyExpenses: calculated.legacyExpenses,
      };
    }
    
    return { 
      totalAmount, 
      totalDebits, 
      totalCredits, 
      totalExpenses: totalAmount,
      ...dashboardBreakdown
    };
  }, [filteredExpenses, dateRange, etsyOrders, orderFees, businessExpenses]);

  // Chart data - by category (returns reduce category totals)
  const categoryData = useMemo(() => {
    const grouped = filteredExpenses.reduce((acc, exp) => {
      const cat = exp.category || "other";
      if (!acc[cat]) acc[cat] = 0;
      const amount = exp.amount || 0;
      acc[cat] += exp.type === "return" ? -amount : amount;
      return acc;
    }, {});
    
    return Object.entries(grouped)
      .filter(([_, amount]) => amount !== 0)
      .map(([category, amount]) => ({
        name: CATEGORIES.find(c => c.value === category)?.label || category,
        value: Math.abs(amount),
        actualValue: amount,
        category,
      })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Top expenses by amount
  const topExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 10)
      .map(exp => ({
        name: exp.description?.substring(0, 30) || "Unnamed",
        amount: exp.amount || 0,
        category: exp.category,
      }));
  }, [filteredExpenses]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;
  }

  const getPeriodLabel = () => {
    if (timeRange === "all") return "All Time";
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

  const clearFilters = () => {
    setCategoryFilter("all");
    setMaterialFilter("all");
    setStatusFilter("all");
    setTimeRange("all");
    setCustomStartDate(null);
    setCustomEndDate(null);
    setSearch("");
    setNavSource(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const getNavigationContext = () => {
    if (!navSource && categoryFilter === "all" && !customStartDate) return null;
    
    const parts = [];
    if (navSource) {
      parts.push(navSource === "dashboard" ? "Dashboard" : 
                 navSource === "netprofit" ? "Net Profit" : 
                 navSource === "actuals" ? "Actuals" : navSource);
    }
    if (categoryFilter !== "all") {
      const cat = CATEGORIES.find(c => c.value === categoryFilter);
      parts.push(cat?.label || categoryFilter);
    }
    if (customStartDate && customEndDate) {
      parts.push(`${format(customStartDate, "MMM yyyy")}`);
    }
    
    return parts.length > 0 ? parts.join(" → ") : null;
  };

  const CHART_COLORS = [
    "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899",
    "#06b6d4", "#f97316", "#84cc16", "#ef4444", "#6366f1", "#71717a"
  ];

  const exportCSV = () => {
    if (!canExportCSV()) {
      setShowExportUpgrade(true);
      return;
    }

    const headers = ["Date", "Description", "Amount", "Category", "Vendor"];
    const rows = filteredExpenses.map(e => [
      e.date,
      e.description,
      e.amount,
      e.category,
      e.vendor
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map(e => e.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.length} expense(s)?`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortableHeader = (field, label) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-stone-900 transition-colors"
    >
      {label}
      {sortField === field ? (
        sortDirection === "asc"
          ? <ArrowUp className="w-3 h-3" />
          : <ArrowDown className="w-3 h-3" />
      ) : (
        <ChevronsUpDown className="w-3 h-3 text-stone-300" />
      )}
    </button>
  );

  const columns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
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
      header: () => renderSortableHeader("date", "Date"),
      render: (row) => {
        const d = row.date ? new Date(row.date + "T00:00:00") : null;
          return (
            <span className="text-stone-600">
              {d && !isNaN(d.getTime()) ? format(d, "MMM d, yyyy") : "-"}
            </span>
          );
      },
    },
    {
      header: () => renderSortableHeader("description", "Description"),
      render: (row) => (
        <div className="max-w-xs">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-stone-900 truncate">{row.description || "-"}</p>
            {row.is_recurring && (
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs flex-shrink-0">
                <RefreshCw className="w-3 h-3 mr-1" />
                {row.recurring_frequency || "Recurring"}
              </Badge>
            )}
          </div>
          {row.vendor && (
            <p className="text-sm text-stone-500 truncate">{row.vendor}</p>
          )}
          {row.material_name && row.category === "materials_supplies" && (
            <p className="text-xs text-blue-600 truncate">🧱 {row.material_name}</p>
          )}
        </div>
      ),
    },
    {
      header: () => renderSortableHeader("amount", "Amount"),
      render: (row) => {
        const amount = row.amount || 0;
        const isReturn = row.type === "return";
        return (
          <span className={`font-semibold ${isReturn ? "text-emerald-600" : "text-stone-900"}`}>
            {isReturn ? "-" : ""}${Math.abs(amount).toFixed(2)}
            {isReturn && <span className="ml-1 text-xs">(return)</span>}
          </span>
        );
      },
    },
    {
      header: () => renderSortableHeader("category", "Category"),
      render: (row) => {
        // Show category badge, only allow editing for legacy expenses
        if (row.source !== "legacy") {
          return (
            <Badge className={categoryColors[row.category] || categoryColors.other}>
              {CATEGORIES.find(c => c.value === row.category)?.label || row.category}
            </Badge>
          );
        }
        
        return (
          <Select
            value={row.category || "other"}
            onValueChange={(v) => handleQuickCategory(row, v)}
          >
            <SelectTrigger className={`w-32 h-8 text-xs font-medium ${categoryColors[row.category] || categoryColors.other}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      header: () => renderSortableHeader("status", "Status"),
      render: (row) => (
        row.is_categorized ? (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
            Reviewed
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
            Needs Review
          </Badge>
        )
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
            <DropdownMenuItem onClick={() => {
              setEditingExpense(row);
              setFormOpen(true);
            }}>
              Edit
            </DropdownMenuItem>
            {row.source === "legacy" && (
              <DropdownMenuItem
                onClick={() => deleteMutation.mutate(row.id)}
                className="text-rose-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const navigationContext = getNavigationContext();

  return (
    <div className="space-y-6">
      {navigationContext && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              Filtered from: {navigationContext}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
          >
            <X className="w-4 h-4 mr-1" />
            Clear filters
          </Button>
        </div>
      )}

      {/* Helper Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>💳 Business Expenses Only:</strong> Import your credit card/bank statement for non-Etsy business expenses. 
          For Etsy fees, ads, and shipping labels, use the <strong>Etsy Activity</strong> page.
        </p>
      </div>

      <PageHeader 
        title="Expenses" 
        description={getPeriodLabel()}
      >
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-2 items-center">
            {["all", "month", "year"].map((range) => (
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
                {range === "all" ? "All Time" : range.charAt(0).toUpperCase() + range.slice(1)}
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
                    } else if (timeRange === "year") {
                      setSelectedDate(new Date(selectedDate.getFullYear() + 1, selectedDate.getMonth()));
                    }
                  }}
                >
                  →
                </Button>
                
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
              </>
            )}
          </div>
          
          <div className="h-6 w-px bg-stone-300 mx-1"></div>
          
          <Button variant="outline" onClick={handleRemoveDuplicates} size="sm" disabled={deduping}>
            <Copy className="w-4 h-4 mr-2" />
            {deduping ? "Scanning..." : "Review Duplicates"}
          </Button>
          <Button variant="outline" onClick={exportCSV} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={() => setPdfImportOpen(true)} size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import from PDF (Beta)
          </Button>
          <Button
            onClick={() => {
              setEditingExpense(null);
              setFormOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </PageHeader>

      {/* Summary - Always matches table data */}
      <div className="bg-white rounded-xl border border-stone-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-stone-500">
              Total Shown {dateRange ? `(${getPeriodLabel()})` : "(All Time)"}
            </p>
            <p className="text-2xl font-bold text-stone-900">${totals.totalAmount.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-stone-500">{filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? "s" : ""}</p>
            {categoryFilter !== "all" && (
              <p className="text-xs text-blue-600 mt-1">
                {CATEGORIES.find(c => c.value === categoryFilter)?.label}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-stone-500">Debits: </span>
            <span className="font-semibold text-stone-900">${totals.totalDebits.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-stone-500">Credits/Returns: </span>
            <span className="font-semibold text-emerald-600">-${totals.totalCredits.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-900">
            {selectedIds.length} expense{selectedIds.length !== 1 ? "s" : ""} selected
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoryFilter === "materials_supplies" && uniqueMaterials.length > 0 && (
            <Select value={materialFilter} onValueChange={setMaterialFilter}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Materials</SelectItem>
                {uniqueMaterials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="uncategorized">Needs Review</SelectItem>
              <SelectItem value="categorized">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {(categoryFilter !== "all" || materialFilter !== "all" || statusFilter !== "all" || timeRange !== "all") && (
          <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
            <span className="text-xs text-stone-500">Active filters:</span>
            {categoryFilter !== "all" && (
              <Badge variant="outline" className="bg-blue-50">
                {CATEGORIES.find(c => c.value === categoryFilter)?.label}
              </Badge>
            )}
            {materialFilter !== "all" && (
              <Badge variant="outline" className="bg-blue-50">
                {materialFilter}
              </Badge>
            )}
            {statusFilter !== "all" && (
              <Badge variant="outline" className="bg-blue-50">
                {statusFilter === "uncategorized" ? "Needs Review" : "Reviewed"}
              </Badge>
            )}
            {timeRange !== "all" && (
              <Badge variant="outline" className="bg-blue-50">
                {getPeriodLabel()}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      {filteredExpenses.length === 0 && !isLoading ? (
        <EmptyState
          icon={Receipt}
          title="No expenses tracked yet"
          description="Add your first expense to start tracking your business costs."
          actionLabel="Add Your First Expense"
          onAction={() => {
            setEditingExpense(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <DataTable
              columns={columns}
              data={filteredExpenses}
              isLoading={isLoading}
              emptyMessage="No expenses match your filters"
            />
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-emerald-600" />
                    Expenses by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => {
                          const actualValue = props.payload.actualValue;
                          return actualValue < 0 
                            ? `-$${Math.abs(actualValue).toFixed(2)} (net return)` 
                            : `$${actualValue.toFixed(2)}`;
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-stone-500 py-12">No data to display</p>
                  )}
                </CardContent>
              </Card>

              {/* Top 10 Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  {topExpenses.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topExpenses} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(val) => `$${val}`} />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                        <Bar dataKey="amount" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-stone-500 py-12">No data to display</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category Summary List */}
            <Card>
              <CardHeader>
                <CardTitle>Category Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryData.map((cat, idx) => (
                    <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-stone-50">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="font-medium text-stone-900">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${cat.actualValue < 0 ? "text-emerald-600" : "text-stone-900"}`}>
                          {cat.actualValue < 0 ? "-" : ""}${cat.value.toFixed(2)}
                          {cat.actualValue < 0 && <span className="ml-1 text-xs">(net return)</span>}
                        </p>
                        <p className="text-xs text-stone-500">
                          {((cat.value / Math.abs(totals.totalAmount || 1)) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <CSVImporter
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Expenses"
        description="Upload your bank or credit card statement CSV. Duplicates will be skipped."
        onImport={handleImport}
      />

      {/* Refund Conflict Warning */}
      {formOpen && editingExpense?.order_id && (
        <RefundConflictWarning
          etsyOrders={etsyOrders}
          etsyStatementLines={etsyStatementLines}
          etsyStatementImports={etsyStatementImports}
          orderIdBeingEdited={editingExpense.order_id}
        />
      )}

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editingExpense}
        onClose={() => {
          setFormOpen(false);
          setEditingExpense(null);
        }}
      />

      <ChasePDFImport open={pdfImportOpen} onOpenChange={setPdfImportOpen} />

      <DuplicateReviewDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        duplicateGroups={duplicateGroups}
        onDelete={handleDeleteDuplicates}
        onMarkRecurring={handleMarkRecurring}
        deleting={deletingDuplicates}
      />

      {showExportUpgrade && (
        <UpgradeCTA
          feature="CSV exports"
          onClose={() => setShowExportUpgrade(false)}
        />
      )}
    </div>
  );
}