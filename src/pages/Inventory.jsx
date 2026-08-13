import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Package, TrendingDown, TrendingUp, Box, Upload, DollarSign, ExternalLink, PackageCheck, ChevronDown, Sparkles } from "lucide-react";
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
  const [showImport, setShowImport] = useState(false);
  const [allocatingPurchase, setAllocatingPurchase] = useState(null);
  const [expenseMatches, setExpenseMatches] = useState({});
  const [matchingLoading, setMatchingLoading] = useState(false);

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

  // AI receipt matching: match credit card charges (material expenses) to
  // receipts (MaterialPurchase records logged via the Maker Assistant) by
  // total amount / vendor / date. Falls back to a deterministic exact match.
  const deterministicMatch = () => {
    const map = {};
    const used = new Set();
    for (const e of materialExpenses) {
      const m = materialPurchases.find(
        (p) =>
          !used.has(p.id) &&
          Math.abs((p.total_cost || 0) - (e.amount || 0)) < 0.01 &&
          (p.vendor || "").toLowerCase() === (e.vendor || "").toLowerCase()
      );
      if (m) {
        map[e.id] = { purchase_id: m.id, note: "Matched by amount + vendor" };
        used.add(m.id);
      }
    }
    return map;
  };

  const runAiMatching = async () => {
    if (!materialExpenses.length || !materialPurchases.length) {
      setExpenseMatches({});
      return;
    }
    setMatchingLoading(true);
    try {
      const expenses = materialExpenses.map((e) => ({
        id: e.id,
        vendor: e.vendor || "",
        amount: e.amount,
        date: e.date,
        description: e.description || "",
      }));
      const purchases = materialPurchases.map((p) => ({
        id: p.id,
        material_name: p.material_name,
        vendor: p.vendor || "",
        total_cost: p.total_cost,
        date: p.purchase_date,
      }));
      const prompt = `You are reconciling a maker's business credit card charges against material purchase receipts.
Match each credit card charge to at most one receipt, and each receipt to at most one charge.
Only match when the total amount is equal (within $0.01) and the vendor/date are compatible.
If there is no confident match for a charge, exclude it from the results.

CREDIT CARD CHARGES:
${JSON.stringify(expenses)}

RECEIPTS (material purchases):
${JSON.stringify(purchases)}

Return JSON with a "matches" array. Each match has expense_id, purchase_id, and a short note explaining why.`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  expense_id: { type: "string" },
                  purchase_id: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
      });
      const aiMatches = Array.isArray(res?.matches) ? res.matches : [];
      const map = { ...deterministicMatch() };
      aiMatches.forEach((m) => {
        if (m.expense_id && m.purchase_id) {
          map[m.expense_id] = { purchase_id: m.purchase_id, note: m.note || "AI matched by total" };
        }
      });
      setExpenseMatches(map);
    } catch (err) {
      console.error("AI matching failed, using deterministic match", err);
      setExpenseMatches(deterministicMatch());
    } finally {
      setMatchingLoading(false);
    }
  };

  const didAutoMatch = useRef(false);
  useEffect(() => {
    if (didAutoMatch.current) return;
    if (materialExpenses.length && materialPurchases.length) {
      didAutoMatch.current = true;
      runAiMatching();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialExpenses, materialPurchases]);

  // Whether a combined-history item is "allocated":
  // - expense (credit card charge): matched to a receipt via AI
  // - purchase (receipt): linked to inventory stock via InventoryTransaction
  const isItemAllocated = (p) =>
    p.source === "expense" ? !!expenseMatches[p.id] : allocatedPurchaseIds.has(p.id);

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
    return matchesSearch && matchesStock;
  });

  // Live inventory value = qty on hand × average cost (recomputed so the
  // card always reflects current stock, even if stored total_value is stale)
  const totalInventoryValue = mergedInventory.reduce(
    (sum, item) => sum + (item.quantity_on_hand * item.average_cost || 0),
    0
  );

  const lowStockItems = mergedInventory.filter((item) => {
    return item.quantity_on_hand <= item.low_stock_threshold && item.quantity_on_hand > 0;
  });

  const outOfStockItems = mergedInventory.filter(
    (item) => item.quantity_on_hand === 0
  );

  // Total money invested in inventory materials:
  //  - all logged receipts (MaterialPurchase) — the primary inventory log
  //  - plus inventory-flagged credit card charges that have no matching receipt
  //    (matched charges are excluded so the same purchase isn't counted twice)
  const matchedExpenseIds = new Set(Object.keys(expenseMatches));
  const totalInvestedInInventory =
    materialPurchases.reduce((sum, p) => sum + (p.total_cost || 0), 0) +
    materialExpenses
      .filter((e) => e.inventory_flag && !matchedExpenseIds.has(e.id))
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
    .filter((p) => isItemAllocated(p))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const unallocatedTotal = purchaseHistoryTotal - allocatedTotal;

  // Credit card charge (material expense) reconciliation vs receipts
  const chargeTotal = materialExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const chargeMatchedTotal = materialExpenses
    .filter((e) => expenseMatches[e.id])
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const chargeUnmatchedTotal = chargeTotal - chargeMatchedTotal;

  // One total row per supplier: combines receipts (MaterialPurchase) and
  // Materials & Supplies credit card charges (BusinessExpense).
  const supplierTotals = (() => {
    const map = new Map();
    for (const p of combinedPurchaseHistory) {
      const key = p.vendor || "Unknown vendor";
      const entry = map.get(key) || { vendor: key, total: 0, count: 0, lastDate: null };
      entry.total += p.amount || 0;
      entry.count += 1;
      if (!entry.lastDate || new Date(p.date || "") > new Date(entry.lastDate)) {
        entry.lastDate = p.date;
      }
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();



  const inventoryColumns = [
    {
      header: "Material Name",
      filterable: true,
      filterValue: (row) => row.material_name,
      sortValue: (row) => row.material_name,
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
          <span className="font-medium text-stone-900">{row.material_name}</span>
        </div>
      ),
    },
    {
      header: "Category",
      filterable: true,
      filterValue: (row) => row.category,
      sortValue: (row) => row.category,
      render: (row) => <span className="text-stone-700 capitalize">{row.category || "-"}</span>,
    },
    {
      header: "Thickness",
      filterable: true,
      filterValue: (row) => row.thickness,
      sortValue: (row) => row.thickness,
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
      filterable: true,
      filterValue: (row) => row.supplier,
      sortValue: (row) => row.supplier,
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
              data={filteredInventory}
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
                  description="Your material purchases and Materials & Supplies expenses will appear here."
                />
              ) : (
                <>
                {/* Reconciliation summary: credit card charges matched to receipts via AI */}
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <p className="text-xs text-stone-500">
                    Materials & Supplies credit card charges, auto-matched to your Maker Assistant receipts by total using AI.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runAiMatching}
                    disabled={matchingLoading}
                    className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {matchingLoading ? "Matching…" : "Re-match with AI"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  <div className="p-3 rounded-lg bg-stone-100 border border-stone-200">
                    <p className="text-xs text-stone-500">Credit Card Charges</p>
                    <p className="text-lg font-bold text-stone-900">{formatCurrency(chargeTotal)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-700">Allocated (Receipt Matched)</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(chargeMatchedTotal)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-700">Unmatched Charges</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(chargeUnmatchedTotal)}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-400 mb-4">
                  Total spent per supplier (receipts + Materials & Supplies charges combined).
                </p>
                <div className="space-y-2">
                  {supplierTotals.map((s) => (
                    <div key={s.vendor} className="border border-stone-200 rounded-lg p-4 bg-white flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900 truncate">{s.vendor}</p>
                        <p className="text-sm text-stone-500">
                          {s.count} purchase{s.count !== 1 ? "s" : ""}
                          {s.lastDate ? ` • last ${new Date(s.lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-stone-900">{formatCurrency(s.total)}</p>
                      </div>
                    </div>
                  ))}
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