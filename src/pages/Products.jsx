import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Package, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import BulkProductImportTool from "@/components/products/BulkProductImportTool";

export default function Products() {
  const { user, loading } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Product.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const { data: materialTypes = [] } = useQuery({
    queryKey: ["materialTypes", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.MaterialType.filter({ owner_user_id: user.id }),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Job.filter({ owner_user_id: user.id }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const filteredProducts = products.filter(p =>
    !search ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getJobCount = (productId) => {
    return jobs.filter(j => j.product_id === productId).length;
  };

  const columns = [
    {
      header: "SKU",
      render: (row) => (
        <span className="font-mono text-sm font-medium text-stone-900">
          {row.sku}
        </span>
      ),
    },
    {
      header: "Product Name",
      render: (row) => (
        <span className="font-medium text-stone-900">{row.name}</span>
      ),
    },
    {
      header: "Material",
      render: (row) => {
        const material = materialTypes.find(m => m.id === row.default_material_id);
        return (
          <span className="text-stone-600">
            {material?.name || "-"}
          </span>
        );
      },
    },
    {
      header: "Area",
      render: (row) => (
        <span className="text-stone-600">
          {row.area_per_unit ? `${row.area_per_unit} sq in` : "-"}
        </span>
      ),
    },
    {
      header: "Laser Time",
      render: (row) => (
        <span className="text-stone-600">
          {row.laser_minutes_per_unit ? `${row.laser_minutes_per_unit} min` : "-"}
        </span>
      ),
    },
    {
      header: "Packaging",
      render: (row) => (
        <span className="text-stone-600">
          {row.packaging_cost ? `$${row.packaging_cost.toFixed(2)}` : "-"}
        </span>
      ),
    },
    {
      header: "Jobs",
      render: (row) => (
        <span className="text-stone-600">{getJobCount(row.id)}</span>
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
              setEditingProduct(row);
              setFormOpen(true);
            }}>
              Edit Defaults
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

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Manage product defaults for faster job creation">
        <Button
          onClick={() => setShowImport(!showImport)}
          variant="outline"
        >
          <Upload className="w-4 h-4 mr-2" />
          Bulk Import
        </Button>
        <Button
          onClick={() => {
            setEditingProduct(null);
            setFormOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </PageHeader>

      {showImport && <BulkProductImportTool />}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {products.length === 0 && !isLoading ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first product to store default materials, specs, and costs for faster job creation."
          actionLabel="Add Your First Product"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredProducts}
          isLoading={isLoading}
          emptyMessage="No products match your search"
        />
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        materialTypes={materialTypes}
        onClose={() => {
          setFormOpen(false);
          setEditingProduct(null);
        }}
      />
    </div>
  );
}