import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Package, TrendingDown, TrendingUp, Box, Upload } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import MaterialTypeDialog from "@/components/materials/MaterialTypeDialog";
import MaterialPurchaseDialog from "@/components/monthly/MaterialPurchaseDialog";
import InventoryAdjustmentDialog from "@/components/inventory/InventoryAdjustmentDialog";
import BulkInventoryImportTool from "@/components/inventory/BulkInventoryImportTool";

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

  const deleteTypeMutation = useMutation({
    mutationFn: (id) => base44.entities.MaterialType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
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
      inventoryItemId: inventoryItem?.id,
    };
  });

  const filteredInventory = mergedInventory.filter(item => {
    const matchesSearch = !search ||
      item.material_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "low" && item.quantity_on_hand <= item.low_stock_threshold && item.quantity_on_hand > 0) ||
      (stockFilter === "out" && item.quantity_on_hand === 0);
    return matchesSearch && matchesStock;
  });

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

  const inventoryColumns = [
    {
      header: "Material Name",
      render: (row) => (
        <div>
          <span className="font-medium text-stone-900">{row.material_name}</span>
          {row.category && (
            <span className="ml-2 text-xs text-stone-500 capitalize">({row.category})</span>
          )}
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
      header: "",
      render: (row) => (
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
      ),
    },
  ];

  const typeColumns = [
    {
      header: "Material",
      render: (row) => (
        <div>
          <span className="font-medium text-stone-900">{row.name}</span>
          {row.thickness && (
            <span className="text-stone-500 ml-2 text-sm">{row.thickness}</span>
          )}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                placeholder="Search materials..."
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
              {materialPurchases.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No purchase history"
                  description="Your material purchases will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {materialPurchases.slice(0, 20).map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-stone-900">{purchase.material_name}</p>
                        <p className="text-sm text-stone-500">
                          {purchase.purchase_date} • {purchase.vendor || "Unknown vendor"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-stone-900">
                            {formatCurrency(purchase.total_cost)}
                          </p>
                          <p className="text-sm text-stone-500">
                            Qty: {purchase.quantity}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPurchase(purchase);
                            setPurchaseFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}