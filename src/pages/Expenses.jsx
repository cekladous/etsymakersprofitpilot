import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
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
import { Plus, Upload, Search, MoreHorizontal, Receipt, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import CSVImporter from "@/components/shared/CSVImporter";
import ExpenseFormDialog from "@/components/expenses/ExpenseFormDialog";

const CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "shipping", label: "Shipping" },
  { value: "tools", label: "Tools" },
  { value: "software", label: "Software" },
  { value: "advertising", label: "Advertising" },
  { value: "utilities", label: "Utilities" },
  { value: "etsy_fees", label: "Etsy Fees" },
  { value: "packaging", label: "Packaging" },
  { value: "equipment", label: "Equipment" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

const categoryColors = {
  materials: "bg-blue-100 text-blue-700",
  shipping: "bg-violet-100 text-violet-700",
  tools: "bg-amber-100 text-amber-700",
  software: "bg-emerald-100 text-emerald-700",
  advertising: "bg-pink-100 text-pink-700",
  utilities: "bg-cyan-100 text-cyan-700",
  etsy_fees: "bg-orange-100 text-orange-700",
  packaging: "bg-lime-100 text-lime-700",
  equipment: "bg-rose-100 text-rose-700",
  maintenance: "bg-indigo-100 text-indigo-700",
  other: "bg-stone-100 text-stone-600",
};

export default function Expenses() {
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const queryClient = useQueryClient();

  // Check URL params for filters
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("filter") === "uncategorized") {
      setStatusFilter("uncategorized");
    }
  }, []);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => base44.entities.Expense.list("-date"),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
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
    const appSettings = settings[0];
    const rules = appSettings?.auto_categorization_rules || [];

    for (const row of rows) {
      const parsed = parseExpenseRow(row);
      if (!parsed.amount || !parsed.date) {
        skipped++;
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
          continue;
        }
      }

      await base44.entities.Expense.create({
        ...parsed,
        category,
        is_categorized: isCategorized,
      });
      added++;
    }

    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    return { success: true, added, updated, skipped };
  };

  const parseExpenseRow = (row) => {
    const date = row["Date"] || row["Transaction Date"] || row["Posted Date"] || "";
    const amount = row["Amount"] || row["Debit"] || row["Charge"] || "";
    
    return {
      transaction_id: row["Transaction ID"] || row["Reference"] || `${date}-${amount}`,
      date: date ? format(new Date(date), "yyyy-MM-dd") : "",
      description: row["Description"] || row["Merchant"] || row["Name"] || "",
      amount: Math.abs(parseFloat(amount?.replace(/[^0-9.-]/g, "") || "0")),
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

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchesSearch = !search ||
        expense.description?.toLowerCase().includes(search.toLowerCase()) ||
        expense.vendor?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "uncategorized" && !expense.is_categorized) ||
        (statusFilter === "categorized" && expense.is_categorized);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [expenses, search, categoryFilter, statusFilter]);

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const exportCSV = () => {
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

  const columns = [
    {
      header: "Date",
      render: (row) => (
        <span className="text-stone-600">
          {row.date ? format(new Date(row.date), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      header: "Description",
      render: (row) => (
        <div className="max-w-xs">
          <p className="font-medium text-stone-900 truncate">{row.description || "-"}</p>
          {row.vendor && (
            <p className="text-sm text-stone-500 truncate">{row.vendor}</p>
          )}
        </div>
      ),
    },
    {
      header: "Amount",
      render: (row) => (
        <span className="font-semibold text-stone-900">
          ${(row.amount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Category",
      render: (row) => (
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
      ),
    },
    {
      header: "Status",
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

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" description="Track and categorize your business expenses">
        <Button variant="outline" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
        <Button
          onClick={() => {
            setEditingExpense(null);
            setFormOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-stone-100 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">Total (filtered)</p>
          <p className="text-2xl font-bold text-stone-900">${totalAmount.toFixed(2)}</p>
        </div>
        <div className="text-sm text-stone-500">
          {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filters */}
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
          <SelectTrigger className="w-full md:w-40">
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

      {/* Table */}
      {expenses.length === 0 && !isLoading ? (
        <EmptyState
          icon={Receipt}
          title="No expenses tracked"
          description="Import your bank or credit card statements or add expenses manually."
          actionLabel="Import CSV"
          onAction={() => setImportOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredExpenses}
          isLoading={isLoading}
          emptyMessage="No expenses match your filters"
        />
      )}

      <CSVImporter
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Expenses"
        description="Upload your bank or credit card statement CSV. Duplicates will be skipped."
        onImport={handleImport}
      />

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editingExpense}
        onClose={() => {
          setFormOpen(false);
          setEditingExpense(null);
        }}
      />
    </div>
  );
}