import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Edit2, TrendingUp, TrendingDown } from "lucide-react";
import InventoryAdjustmentDialog from "../components/inventory/InventoryAdjustmentDialog";

export default function InventoryPage() {
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => base44.entities.InventoryItem.list("-last_updated", 500),
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

  const handleAdjust = (item) => {
    setSelectedItem(item);
    setAdjustmentDialogOpen(true);
  };

  const totalInventoryValue = inventoryItems.reduce(
    (sum, item) => sum + (item.total_value || 0),
    0
  );

  const lowStockItems = inventoryItems.filter(
    (item) => item.quantity_on_hand <= 5 && item.quantity_on_hand > 0
  );

  const outOfStockItems = inventoryItems.filter(
    (item) => item.quantity_on_hand === 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Inventory</h1>
          <p className="text-stone-500 mt-1">
            Track materials and supplies on hand
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
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

        <Card>
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

        <Card>
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

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-stone-500">
              Loading inventory...
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-500">
                No inventory items yet. Purchase materials to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Name</TableHead>
                  <TableHead className="text-right">Quantity on Hand</TableHead>
                  <TableHead className="text-right">Average Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.quantity_on_hand === 0
                        ? "bg-rose-50"
                        : item.quantity_on_hand <= 5
                        ? "bg-yellow-50"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">
                      {item.material_name}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.quantity_on_hand)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.average_cost)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.total_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAdjust(item)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjustment Dialog */}
      <InventoryAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        item={selectedItem}
      />
    </div>
  );
}