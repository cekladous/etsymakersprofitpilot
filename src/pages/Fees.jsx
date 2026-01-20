import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, Trash2, DollarSign, CreditCard, Tag } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";

export default function Fees() {
  const [search, setSearch] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);

  const queryClient = useQueryClient();

  const { data: fees = [], isLoading } = useQuery({
    queryKey: ["fees"],
    queryFn: () => base44.entities.Fee.list("-transaction_date", 5000),
  });

  const { data: etsyStatementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports"],
    queryFn: () => base44.entities.EtsyStatementImport.list(),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.Fee.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      setSelectedIds([]);
    },
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const filteredFees = useMemo(() => {
    return fees.filter(fee => {
      // Exclude fees from replaced imports
      if (fee.import_id) {
        const feeImport = etsyStatementImports.find(imp => imp.id === fee.import_id);
        if (feeImport && feeImport.status === 'replaced') return false;
      }

      const matchesSearch = !search || 
        fee.description?.toLowerCase().includes(search.toLowerCase()) ||
        fee.order_id?.toLowerCase().includes(search.toLowerCase()) ||
        fee.fee_type?.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = feeTypeFilter === "all" || fee.fee_type === feeTypeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [fees, etsyStatementImports, search, feeTypeFilter]);

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

  const feeTypeCounts = useMemo(() => {
    const counts = {};
    filteredFees.forEach(fee => {
      counts[fee.fee_type] = (counts[fee.fee_type] || 0) + 1;
    });
    return counts;
  }, [filteredFees]);

  const totalFees = filteredFees.reduce((sum, f) => sum + Math.abs(f.amount || 0), 0);

  const exportFees = () => {
    const csv = [
      ["Date", "Order ID", "Fee Type", "Amount", "Description"],
      ...filteredFees.map(f => [
        f.transaction_date,
        f.order_id || "—",
        feeTypeLabels[f.fee_type] || f.fee_type,
        f.amount,
        f.description || ""
      ])
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etsy-fees-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredFees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredFees.map(f => f.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.length} fee record(s)?`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const columns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.length === filteredFees.length && filteredFees.length > 0}
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
      header: "Date",
      render: (row) => row.transaction_date || "—",
    },
    {
      header: "Order ID",
      render: (row) => (
        <div className="max-w-32 truncate">
          {row.order_id ? (
            <span className="text-blue-600">#{row.order_id}</span>
          ) : (
            <span className="text-stone-400">No order</span>
          )}
        </div>
      ),
    },
    {
      header: "Fee Type",
      render: (row) => (
        <span className="text-sm capitalize">
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
      header: "Amount",
      render: (row) => (
        <span className={`font-semibold ${row.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {formatCurrency(row.amount || 0)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Etsy Fees" 
        description={`${filteredFees.length} fee records • Total: ${formatCurrency(totalFees)}`}
      >
        <Button variant="outline" size="sm" onClick={exportFees}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Fees</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalFees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Fee Records</p>
                <p className="text-2xl font-bold text-stone-900">
                  {filteredFees.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Tag className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Matched to Orders</p>
                <p className="text-2xl font-bold text-stone-900">
                  {filteredFees.filter(f => f.order_id).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-900">
            {selectedIds.length} fee{selectedIds.length !== 1 ? "s" : ""} selected
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
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search by order ID or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={feeTypeFilter} onValueChange={setFeeTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Fee Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All Fee Types ({filteredFees.length})
            </SelectItem>
            {Object.keys(feeTypeLabels).map((type) => (
              <SelectItem key={type} value={type}>
                {feeTypeLabels[type]} ({feeTypeCounts[type] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {fees.length === 0 && !isLoading ? (
        <EmptyState
          icon={CreditCard}
          title="No fees imported"
          description="Import an Etsy statement to view fee records here."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredFees}
          isLoading={isLoading}
          emptyMessage="No fees match your filters"
        />
      )}
    </div>
  );
}