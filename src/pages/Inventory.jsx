import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Package, TrendingDown, TrendingUp, Box, Upload, DollarSign, ExternalLink, PackageCheck, ChevronDown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import MaterialTypeDialog from "@/components/materials/MaterialTypeDialog";
import MaterialPurchaseDialog from "@/components/monthly/MaterialPurchaseDialog";
import InventoryAdjustmentDialog from "@/components/inventory/InventoryAdjustmentDialog";
import BulkInventoryImportTool from "@/components/inventory/BulkInventoryImportTool";
import AllocatePurchaseDialog from "@/components/inventory/AllocatePurchaseDialog";

export default function Inventory() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("inventory");
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [thicknessFilter, setThicknessFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("none"); // none | az | za
  const [showImport, setShowImport] = useState(false);
  const [allocatingPurchase, setAllocatingPurchase] = useState(null);
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  const queryClient = useQueryClient();

  const { data: materialTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["materialTypes", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialType.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["inventory-items", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.InventoryItem.filter({ owner_user_id: user.id }, "-last_updated", 500),
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialPurchase.filter({ owner_user_id: user.id }, "-purchase_date", 100),
  });

  const { data: materialExpenses = [] } = useQuery({
    queryKey: ["material-expenses", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BusinessExpense.filter({ owner_user_id: user.id, category_name: "materials_supplies" }, "-date", 200),
  });

  const { data: inventoryTransactions = [] } = useQuery({
    queryKey: ["inventory-transactions", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.InventoryTransaction.filter({ owner_user_id: user.id, transaction_type: "purchase" }, "-transaction_date", 500),
  });

  // Set of source purchase IDs that have already been allocated to inventory
  const allocatedPurchaseIds = new Set(
    inventoryTransactions.map((t) => t.reference_id).filter(Boolean)
  );

  // Live-update when the assistant (or any source) changes inventory data
  useEffect(() => {
    if (!user?.id) return;
    const unsubs = [
      base44.entities.MaterialType.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ["materialTypes", user.id] });
      }),
      base44.entities.InventoryItem.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ["inventory-items", user.id] });
      }),
      base44.entities.MaterialPurchase.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ["material-purchases", user.id] });
      }),
      base44.entities.InventoryTransaction.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ["inventory-transactions", user.id] });
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [user?.id]);

  const deleteTypeMutation = useMutation({
    mutationFn: (id) => base44.entities.MaterialType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
    },
  });

  const deleteInventoryMutation = useMutation({
    mutationFn: async (row) => {
      const materialName = row.material_name;
      // Delete the inventory item record
      if (row.inventoryItemId) {
        await base44.entities.InventoryItem.delete(row.inventoryItemId);
      }
      // Delete orphaned purchase records tied to this material
      const relatedPurchases = materialPurchases.filter(
        (p) => p.material_name === materialName
      );
      await Promise.all(
        relatedPurchases.map((p) => base44.entities.MaterialPurchase.delete(p.id))
      );
      // Delete orphaned inventory transactions tied to this material's inventory item
      const relatedTxns = inventoryTransactions.filter(
        (t) => t.inventory_item_id === row.inventoryItemId
      );
      await Promise.all(
        relatedTxns.map((t) => base44.entities.InventoryTransaction.delete(t.id))
      );
      // Finally delete the material type itself
      await base44.entities.MaterialType.delete(row.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["material-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
    },
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getItemLowStockThreshold = (item) => {
    const materialType = materialTypes.find(t => t.name === item.material_name);
    return materialType?.low_stock_threshold || 5;
  };

  // Merge MaterialType and InventoryItem data for complete inventory view
  const mergedInventory = materialTypes.map(materialType => {
    const inventoryItem = inventoryItems.find(i => i.material_name === materialType.name);
    return {
      id: materialType.id,
      material_name: materialType.name,
      thickness: materialType.thickness || "",
      width: materialType.default_width || 0,
      height: materialType.default_height || 0,
      cost_per_sheet: materialType.cost_per_sheet || 0,
      quantity_on_hand: inventoryItem?.quantity_on_hand || 0,
      average_cost: inventoryItem?.average_cost || materialType.cost_per_sheet || 0,
      total_value: inventoryItem?.total_value || 0,
      low_stock_threshold: materialType.low_stock_threshold || 5,
      category: materialType.category,
      supplier: materialType.supplier || "",
      reorder_url: materialType.reorder_url || "",
      image_url: materialType.image_url || "",
      inventoryItemId: inventoryItem?.id,
      last_purchase_date: (() => {
        const purchases = materialPurchases
          .filter((p) => p.material_name === materialType.name && p.purchase_date)
          .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
        return purchases[0]?.purchase_date || null;
      })(),
    };
  });

  // Unique values for per-column dropdown filters
  const uniqueSuppliers = [...new Set(mergedInventory.map((i) => i.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const uniqueCategories = [...new Set(mergedInventory.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const uniqueThicknesses = [...new Set(mergedInventory.map((i) => i.thickness).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const filteredInventory = mergedInventory.filter(item => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      [
        item.material_name,
        item.thickness,
        item.category,
        item.supplier,
        item.width != null ? String(item.width) : "",
        item.height != null ? String(item.height) : "",
        item.cost_per_sheet != null ? String(item.cost_per_sheet) : "",
        item.quantity_on_hand != null ? String(item.quantity_on_hand) : "",
        item.average_cost != null ? String(item.average_cost) : "",
        item.total_value != null ? String(item.total_value) : "",
        item.low_stock_threshold != null ? String(item.low_stock_threshold) : "",
        item.last_purchase_date ? new Date(item.last_purchase_date).toLocaleDateString("en-US") : "",
        item.last_purchase_date ? new Date(item.last_purchase_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      ].some((field) => field?.toString().toLowerCase().includes(q));
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "low" && item.quantity_on_hand <= item.low_stock_threshold && item.quantity_on_hand > 0) ||
      (stockFilter === "out" && item.quantity_on_hand === 0);
    const matchesSupplier = supplierFilter === "all" || item.supplier === supplierFilter;
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesThickness = thicknessFilter === "all" || item.thickness === thicknessFilter;
    return matchesSearch && matchesStock && matchesSupplier && matchesCategory && matchesThickness;
  });

  const sortedInventory = [...filteredInventory].sort((a, b) => {
    if (sortOrder === "az") return (a.material_name || "").localeCompare(b.material_name || "");
    if (sortOrder === "za") return (b.material_name || "").localeCompare(a.material_name || "");
    return 0;
  });

  const hasColumnFilters = supplierFilter !== "all" || categoryFilter !== "all" || thicknessFilter !== "all" || sortOrder !== "none";
  const clearColumnFilters = () => {
    setSupplierFilter("all");
    setCategoryFilter("all");
    setThicknessFilter("all");
    setSortOrder("none");
  };

  const totalInventoryValue = mergedInventory.reduce(
    (sum, item) => sum + (item.total_value || 0),
    0
  );

  const lowStockItems = mergedInventory.filter((item) => {
    return item.quantity_on_hand <= item.low_stock_threshold && item.quantity_on_hand > 0;
  });

  const outOfStockItems = mergedInventory.filter(
    (item) => item.quantity_on_hand === 0
  );

  const totalInvestedInInventory = materialExpenses
    .filter((e) => e.inventory_flag)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Purchase History combines two sources, clearly labeled:
  //  - "purchase": MaterialPurchase logs (from Log Purchase / Maker Assistant receipts)
  //  - "expense": BusinessExpense records categorized as materials_supplies
  // Allocation badge shows whether each item has been linked to inventory stock.
  const combinedPurchaseHistory = [
    ...materialPurchases.map((p) => ({
      id: p.id,
      source: "purchase",
      date: p.purchase_date,
      material_name: p.material_name,
      vendor: p.vendor || "Unknown vendor",
      amount: p.total_cost,
      quantity: p.quantity,
      goes_to_inventory: true,
    })),
    ...materialExpenses.map((e) => ({
      id: e.id,
      source: "expense",
      date: e.date,
      material_name: e.description,
      vendor: e.vendor || "Unknown vendor",
      amount: e.amount,
      quantity: null,
      goes_to_inventory: e.inventory_flag || false,
    })),
  ].sort((a, b) => new Date(b.date || "") - new Date(a.date || ""));

  // Allocation summary across the combined history
  const purchaseHistoryTotal = combinedPurchaseHistory.reduce(
    (sum, p) => sum + (p.amount || 0), 0
  );
  const allocatedTotal = combinedPurchaseHistory
    .filter((p) => allocatedPurchaseIds.has(p.id))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const unallocatedTotal = purchaseHistoryTotal - allocatedTotal;

  // Group purchase history by supplier (totals per supplier, not per material)
  const supplierTotals = (() => {
    const map = new Map();
    for (const p of combinedPurchaseHistory) {
      const key = p.vendor || "Unknown vendor";
      const entry = map.get(key) || {
        vendor: key,
        total: 0,
        allocated: 0,
        unallocated: 0,
        count: 0,
        lastDate: null,
        purchases: [],
      };
      entry.total += p.amount || 0;
      entry.count += 1;
      if (allocatedPurchaseIds.has(p.id)) entry.allocated += p.amount || 0;
      else entry.unallocated += p.amount || 0;
      if (!entry.lastDate || new Date(p.date || "") > new Date(entry.lastDate)) {
        entry.lastDate = p.date;
      }
      entry.purchases.push(p);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();

  const inventoryColumns = [
    {
      header: "Material Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
            <img
              src={row.image_url}
              alt={row.material_name}
              className="w-10 h-10 rounded-lg object-cover border border-stone-200 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-stone-400" />
            </div>
          )}
          <div>
            <span className="font-medium text-stone-900">{row.material_name}</span>
            {row.category && (
              <span className="ml-2 text-xs text-stone-500 capitalize">({row.category})</span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Thickness",
      render: (row) => <span className="text-stone-700">{row.thickness || "-"}</span>,
    },
    {
      header: "Width (in)",
      render: (row) => <span className="text-stone-700">{formatNumber(row.width)}</span>,
    },
    {
      header: "Height (in)",
      render: (row) => <span className="text-stone-700">{formatNumber(row.height)}</span>,
    },
    {
      header: "Cost/Sheet",
      render: (row) => <span className="text-stone-700">{formatCurrency(row.cost_per_sheet)}</span>,
    },
    {
      header: "Quantity on Hand",
      render: (row) => {
        const isLow = row.quantity_on_hand <= row.low_stock_threshold && row.quantity_on_hand > 0;
        const isOut = row.quantity_on_hand === 0;
        return (
          <span className={`font-medium ${isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-stone-900"}`}>
            {formatNumber(row.quantity_on_hand)}
          </span>
        );
      },
    },
    {
      header: "Average Cost",
      render: (row) => <span className="text-stone-600">{formatCurrency(row.average_cost)}</span>,
    },
    {
      header: "Total Value",
      render: (row) => <span className="font-semibold">{formatCurrency(row.total_value)}</span>,
    },
    {
      header: "Last Purchased",
      render: (row) => (
        <span className="text-stone-600">
          {row.last_purchase_date
            ? new Date(row.last_purchase_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "-"}
        </span>
      ),
    },
    {
      header: "Supplier",
      render: (row) => (
        <span className="text-stone-600">{row.supplier || "-"}</span>
      ),
    },
    {
      header: "",
      render: (row) => (
        <div className="flex gap-2">
          {row.reorder_url ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              asChild
            >
              <a href={row.reorder_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
                Reorder
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingType(materialTypes.find(t => t.id === row.id));
              setTypeFormOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const item = row.inventoryItemId
                ? inventoryItems.find(i => i.id === row.inventoryItemId)
                : { id: null, material_name: row.material_name, quantity_on_hand: 0, average_cost: row.average_cost };
              setSelectedItem(item);
              setAdjustmentDialogOpen(true);
            }}
          >
            Adjust
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(`Delete "${row.material_name}" and its inventory record? This cannot be undone.`)) {
                deleteInventoryMutation.mutate(row);
              }
            }}
            className="text-rose-600"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const typeColumns = [
    {
      header: "Material",
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
            <img
              src={row.image_url}
              alt={row.name}
              className="w-10 h-10 rounded-lg object-cover border border-stone-200 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-stone-400" />
            </div>
          )}
          <div>
            <span className="font-medium text-stone-900">{row.name}</span>
            {row.thickness && (
              <span className="text-stone-500 ml-2 text-sm">{row.thickness}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Category",
      render: (row) => (
        <span className="capitalize text-stone-600">{row.category?.replace(/_/g, " ")}</span>
      ),
    },
    {
      header: "Default Cost",
      render: (row) => (
        <span className="font-medium">{formatCurrency(row.cost_per_sheet || 0)}</span>
      ),
    },
    {
      header: "",
      render: (row) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingType(row);
              setTypeFormOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteTypeMutation.mutate(row.id)}
            className="text-rose-600"
          >
            Delete
          </Button>
        </div>
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
      <PageHeader title="Inventory" description="Track materials, purchases, and inventory levels">
        <Button
          onClick={() => setShowImport(!showImport)}
          variant="outline"
        >
          <Upload className="w-4 h-4 mr-2" />
          Bulk Import
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setEditingType(null);
            setTypeFormOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Material Type
        </Button>
        <Button
          onClick={() => setPurchaseFormOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Purchase
        </Button>
      </PageHeader>

      {showImport && <BulkInventoryImportTool />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Invested in Inventory</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(totalInvestedInInventory)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setActiveTab("inventory");
            setStockFilter("all");
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Package className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Inventory Value</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalInventoryValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setActiveTab("inventory");
            setStockFilter("low");
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Low Stock Items</p>
                <p className="text-2xl font-bold text-stone-900">
                  {lowStockItems.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setActiveTab("inventory");
            setStockFilter("out");
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Out of Stock</p>
                <p className="text-2xl font-bold text-stone-900">
                  {outOfStockItems.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-stone-100">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="types">Material Types</TabsTrigger>
          <TabsTrigger value="history">Purchase History</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-6 space-y-6">
          {/* Filters */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  placeholder="Search any column: name, thickness, supplier, cost, qty…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {["all", "low", "out"].map((filter) => (
                  <Button
                    key={filter}
                    variant={stockFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStockFilter(filter)}
                    className={stockFilter === filter ? "bg-emerald-600" : ""}
                  >
                    {filter === "all" ? "All" : filter === "low" ? "Low Stock" : "Out of Stock"}
                  </Button>
                ))}
              </div>
            </div>
            {/* Per-column dropdown filters + A-Z/Z-A sort */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex flex-wrap gap-3">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {uniqueSuppliers.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={thicknessFilter} onValueChange={setThicknessFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Thickness" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Thicknesses</SelectItem>
                    {uniqueThicknesses.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 md:ml-auto">
                <Button
                  variant={sortOrder === "az" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "az" ? "none" : "az")}
                  className={sortOrder === "az" ? "bg-emerald-600" : ""}
                >
                  A–Z
                </Button>
                <Button
                  variant={sortOrder === "za" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "za" ? "none" : "za")}
                  className={sortOrder === "za" ? "bg-emerald-600" : ""}
                >
                  Z–A
                </Button>
                {hasColumnFilters && (
                  <Button variant="ghost" size="sm" onClick={clearColumnFilters}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {materialTypes.length === 0 && !typesLoading ? (
            <EmptyState
              icon={Box}
              title="No inventory items"
              description="Purchase materials to start tracking inventory."
              actionLabel="Log Purchase"
              onAction={() => setPurchaseFormOpen(true)}
            />
          ) : (
            <DataTable
              columns={inventoryColumns}
              data={sortedInventory}
              isLoading={inventoryLoading}
              emptyMessage="No inventory matches your filters"
            />
          )}
        </TabsContent>

        <TabsContent value="types" className="mt-6 space-y-6">
          {materialTypes.length === 0 && !typesLoading ? (
            <EmptyState
              icon={Package}
              title="No material types"
              description="Define material types for tracking and costing."
              actionLabel="Add Material Type"
              onAction={() => setTypeFormOpen(true)}
            />
          ) : (
            <DataTable
              columns={typeColumns}
              data={materialTypes}
              isLoading={typesLoading}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardContent className="p-6">
              {combinedPurchaseHistory.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No purchase history"
                  description="Your material purchases will appear here."
                />
              ) : (
                <>
                {/* Allocation summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  <div className="p-3 rounded-lg bg-stone-100 border border-stone-200">
                    <p className="text-xs text-stone-500">Total Spent (Materials)</p>
                    <p className="text-lg font-bold text-stone-900">{formatCurrency(purchaseHistoryTotal)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-700">Allocated to Inventory</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(allocatedTotal)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-700">Unallocated</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(unallocatedTotal)}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-400 mb-4">
                  Grouped by supplier showing total spent. Click a supplier to expand and see the individual purchases, then use <span className="font-medium text-stone-600">Allocate</span> to link an item to inventory stock.
                </p>
                <div className="space-y-2">
                  {supplierTotals.map((s) => {
                    const isOpen = expandedSupplier === s.vendor;
                    return (
                      <div key={s.vendor} className="border border-stone-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedSupplier(isOpen ? null : s.vendor)}
                          className="w-full flex items-center justify-between p-4 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                            <div className="min-w-0">
                              <p className="font-medium text-stone-900 truncate">{s.vendor}</p>
                              <p className="text-sm text-stone-500">
                                {s.count} purchase{s.count !== 1 ? "s" : ""}
                                {s.lastDate ? ` • last ${new Date(s.lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-semibold text-stone-900">{formatCurrency(s.total)}</p>
                              <p className="text-xs text-stone-500">
                                <span className="text-emerald-600">{formatCurrency(s.allocated)}</span> / <span className="text-amber-600">{formatCurrency(s.unallocated)}</span>
                              </p>
                            </div>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-stone-100">
                            {s.purchases.map((purchase) => (
                              <div
                                key={`${purchase.source}-${purchase.id}`}
                                className="flex items-center justify-between p-4 bg-white hover:bg-stone-50 transition-colors"
                              >
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-stone-900">{purchase.material_name}</p>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${purchase.source === "purchase" ? "bg-blue-100 text-blue-700" : "bg-stone-200 text-stone-600"}`}>
                                      {purchase.source === "purchase" ? "Purchase" : "Expense"}
                                    </span>
                                    {allocatedPurchaseIds.has(purchase.id) ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                        <PackageCheck className="w-3 h-3" />
                                        Allocated
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                        Unallocated
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-stone-500">
                                    {purchase.date} • {formatCurrency(purchase.amount)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant={allocatedPurchaseIds.has(purchase.id) ? "ghost" : "outline"}
                                    size="sm"
                                    onClick={() => setAllocatingPurchase(purchase)}
                                    className={allocatedPurchaseIds.has(purchase.id) ? "" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}
                                  >
                                    {allocatedPurchaseIds.has(purchase.id) ? "Re-allocate" : "Allocate"}
                                  </Button>
                                  {purchase.source === "purchase" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingPurchase(materialPurchases.find(p => p.id === purchase.id));
                                        setPurchaseFormOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MaterialTypeDialog
        open={typeFormOpen}
        onOpenChange={setTypeFormOpen}
        materialType={editingType}
        onClose={() => {
          setTypeFormOpen(false);
          setEditingType(null);
        }}
      />

      <MaterialPurchaseDialog
        open={purchaseFormOpen}
        onOpenChange={(open) => {
          setPurchaseFormOpen(open);
          if (!open) setEditingPurchase(null);
        }}
        purchase={editingPurchase}
      />

      <InventoryAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        item={selectedItem}
      />

      <AllocatePurchaseDialog
        open={!!allocatingPurchase}
        onOpenChange={(open) => { if (!open) setAllocatingPurchase(null); }}
        purchase={allocatingPurchase}
      />
    </div>
  );
}