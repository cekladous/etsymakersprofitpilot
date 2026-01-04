import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Layers, Package2, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import MaterialTypeDialog from "@/components/materials/MaterialTypeDialog";
import MaterialSheetDialog from "@/components/materials/MaterialSheetDialog";
import MaterialUsageDialog from "@/components/materials/MaterialUsageDialog";

export default function Materials() {
  const [activeTab, setActiveTab] = useState("sheets");
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [sheetFormOpen, setSheetFormOpen] = useState(false);
  const [usageFormOpen, setUsageFormOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editingSheet, setEditingSheet] = useState(null);
  const [selectedSheetForUsage, setSelectedSheetForUsage] = useState(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const queryClient = useQueryClient();

  // Check URL params for filters
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("filter") === "low_stock") {
      setStockFilter("low");
    }
  }, []);

  const { data: materialTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["materialTypes"],
    queryFn: () => base44.entities.MaterialType.list("-created_date"),
  });

  const { data: sheets = [], isLoading: sheetsLoading } = useQuery({
    queryKey: ["materialSheets"],
    queryFn: () => base44.entities.MaterialSheet.list("-created_date"),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id) => base44.entities.MaterialType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
    },
  });

  const deleteSheetMutation = useMutation({
    mutationFn: (id) => base44.entities.MaterialSheet.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialSheets"] });
    },
  });

  const getTypeName = (typeId) => {
    const type = materialTypes.find(t => t.id === typeId);
    return type?.name || "-";
  };

  const getSheetCount = (typeId) => {
    return sheets.filter(s => s.material_type_id === typeId && s.status !== "depleted").length;
  };

  const isLowStock = (sheet) => {
    return sheet.remaining_percentage <= 20 && sheet.status !== "depleted";
  };

  const filteredSheets = sheets.filter(sheet => {
    const type = materialTypes.find(t => t.id === sheet.material_type_id);
    const matchesSearch = !search ||
      type?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "low" && isLowStock(sheet)) ||
      (stockFilter === "available" && sheet.status === "available");
    return matchesSearch && matchesStock;
  });

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
      header: "Size",
      render: (row) => (
        <span className="text-stone-600">
          {row.default_width && row.default_height
            ? `${row.default_width}" × ${row.default_height}"`
            : "-"}
        </span>
      ),
    },
    {
      header: "Cost/Sheet",
      render: (row) => (
        <span className="font-medium">${(row.cost_per_sheet || 0).toFixed(2)}</span>
      ),
    },
    {
      header: "In Stock",
      render: (row) => (
        <span className="text-stone-600">{getSheetCount(row.id)} sheets</span>
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
              setEditingType(row);
              setTypeFormOpen(true);
            }}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteTypeMutation.mutate(row.id)}
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

  const sheetColumns = [
    {
      header: "Material",
      render: (row) => (
        <span className="font-medium text-stone-900">{getTypeName(row.material_type_id)}</span>
      ),
    },
    {
      header: "Size",
      render: (row) => (
        <span className="text-stone-600">
          {row.width && row.height ? `${row.width}" × ${row.height}"` : "-"}
        </span>
      ),
    },
    {
      header: "Remaining",
      render: (row) => {
        const pct = row.remaining_percentage || 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-stone-600">{pct.toFixed(0)}%</span>
          </div>
        );
      },
    },
    {
      header: "Remaining Value",
      render: (row) => (
        <span className="font-medium">${(row.remaining_value || 0).toFixed(2)}</span>
      ),
    },
    {
      header: "Status",
      render: (row) => {
        if (isLowStock(row)) {
          return <StatusBadge status="low_stock" />;
        }
        return <StatusBadge status={row.status} />;
      },
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
              setSelectedSheetForUsage(row);
              setUsageFormOpen(true);
            }}>
              Log Usage
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setEditingSheet(row);
              setSheetFormOpen(true);
            }}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteSheetMutation.mutate(row.id)}
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
      <PageHeader title="Materials" description="Track material types and individual sheets">
        <Button
          variant="outline"
          onClick={() => {
            setEditingType(null);
            setTypeFormOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
        <Button
          onClick={() => {
            setEditingSheet(null);
            setSheetFormOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Sheet
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-stone-100">
          <TabsTrigger value="sheets">Sheets</TabsTrigger>
          <TabsTrigger value="types">Material Types</TabsTrigger>
        </TabsList>

        <TabsContent value="sheets" className="mt-6 space-y-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Search by material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {["all", "available", "low"].map((filter) => (
                <Button
                  key={filter}
                  variant={stockFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStockFilter(filter)}
                  className={stockFilter === filter ? "bg-emerald-600" : ""}
                >
                  {filter === "all" ? "All" : filter === "low" ? "Low Stock" : "Available"}
                </Button>
              ))}
            </div>
          </div>

          {sheets.length === 0 && !sheetsLoading ? (
            <EmptyState
              icon={Package2}
              title="No sheets tracked"
              description="Add individual material sheets to track usage and remaining value."
              actionLabel="Add Sheet"
              onAction={() => setSheetFormOpen(true)}
            />
          ) : (
            <DataTable
              columns={sheetColumns}
              data={filteredSheets}
              isLoading={sheetsLoading}
              emptyMessage="No sheets match your filters"
            />
          )}
        </TabsContent>

        <TabsContent value="types" className="mt-6 space-y-6">
          {materialTypes.length === 0 && !typesLoading ? (
            <EmptyState
              icon={Layers}
              title="No material types"
              description="Define your material types with sizes and costs."
              actionLabel="Add Material"
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

      <MaterialSheetDialog
        open={sheetFormOpen}
        onOpenChange={setSheetFormOpen}
        sheet={editingSheet}
        materialTypes={materialTypes}
        onClose={() => {
          setSheetFormOpen(false);
          setEditingSheet(null);
        }}
      />

      <MaterialUsageDialog
        open={usageFormOpen}
        onOpenChange={setUsageFormOpen}
        sheet={selectedSheetForUsage}
        onClose={() => {
          setUsageFormOpen(false);
          setSelectedSheetForUsage(null);
        }}
      />
    </div>
  );
}