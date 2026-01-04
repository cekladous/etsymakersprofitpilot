import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Upload,
  Search,
  MoreHorizontal,
  ExternalLink,
  Wrench,
  AlertTriangle,
  Download,
  ShoppingBag
} from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import CSVImporter from "@/components/shared/CSVImporter";
import OrderFormDialog from "@/components/orders/OrderFormDialog";

export default function Orders() {
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  
  const queryClient = useQueryClient();

  // Check URL params for filters
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("filter") === "missing_job") {
      setJobFilter("missing");
    }
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-sale_date"),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list(),
  });

  const importMutation = useMutation({
    mutationFn: async (rows, parseRow, getUniqueKey) => {
      let added = 0, updated = 0, skipped = 0;
      
      for (const row of rows) {
        const parsed = parseRow(row);
        if (!parsed.order_id) {
          skipped++;
          continue;
        }
        
        const existing = orders.find(o => 
          o.order_id === parsed.order_id && o.channel === parsed.channel
        );
        
        if (existing) {
          await base44.entities.Order.update(existing.id, parsed);
          updated++;
        } else {
          await base44.entities.Order.create(parsed);
          added++;
        }
      }
      
      return { success: true, added, updated, skipped };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const handleImport = async (rows, parseRow, getUniqueKey) => {
    let added = 0, updated = 0, skipped = 0;
    
    for (const row of rows) {
      const parsed = parseEtsyRow(row);
      if (!parsed.order_id) {
        skipped++;
        continue;
      }
      
      const existing = orders.find(o => 
        o.order_id === parsed.order_id && o.channel === parsed.channel
      );
      
      if (existing) {
        await base44.entities.Order.update(existing.id, parsed);
        updated++;
      } else {
        await base44.entities.Order.create(parsed);
        added++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    return { success: true, added, updated, skipped };
  };

  const parseEtsyRow = (row) => {
    // Common Etsy CSV column mappings
    const orderId = row["Order ID"] || row["order_id"] || row["Receipt ID"] || "";
    const saleDate = row["Sale Date"] || row["Date"] || row["Created Date"] || "";
    
    return {
      channel: "etsy",
      order_id: orderId.toString(),
      sale_date: saleDate ? format(new Date(saleDate), "yyyy-MM-dd") : "",
      sku: row["SKU"] || row["Item Name"] || "",
      product_name: row["Item Name"] || row["Title"] || "",
      quantity: parseInt(row["Quantity"] || row["Qty"] || "1") || 1,
      gross_total: parseFloat(row["Order Total"] || row["Total"] || row["Order Value"] || "0") || 0,
      shipping_charged: parseFloat(row["Shipping"] || row["Shipping Price"] || "0") || 0,
      discounts: parseFloat(row["Discount Amount"] || row["Coupon Discount"] || "0") || 0,
      refunds: parseFloat(row["Refund"] || row["Refund Amount"] || "0") || 0,
      sales_tax: parseFloat(row["Sales Tax"] || row["Tax"] || "0") || 0,
      etsy_fees: parseFloat(row["Etsy Fees"] || row["Listing Fee"] || row["Transaction Fee"] || "0") || 0,
      processing_fees: parseFloat(row["Processing Fee"] || row["Payment Processing Fee"] || "0") || 0,
      net_payout: parseFloat(row["Net"] || row["Amount Deposited"] || "0") || 0,
      status: "pending",
    };
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = !search || 
        order.order_id?.toLowerCase().includes(search.toLowerCase()) ||
        order.sku?.toLowerCase().includes(search.toLowerCase()) ||
        order.product_name?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      
      const matchesJob = jobFilter === "all" || 
        (jobFilter === "missing" && !order.job_id) ||
        (jobFilter === "linked" && order.job_id);
      
      return matchesSearch && matchesStatus && matchesJob;
    });
  }, [orders, search, statusFilter, jobFilter]);

  const exportCSV = () => {
    const headers = ["Order ID", "Date", "SKU", "Product", "Qty", "Gross", "Fees", "Net", "Status"];
    const rows = filteredOrders.map(o => [
      o.order_id,
      o.sale_date,
      o.sku,
      o.product_name,
      o.quantity,
      o.gross_total,
      (o.etsy_fees || 0) + (o.processing_fees || 0),
      o.net_payout,
      o.status
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const columns = [
    {
      header: "Order",
      render: (row) => (
        <div>
          <p className="font-medium text-stone-900">{row.order_id}</p>
          <p className="text-sm text-stone-500">{row.channel}</p>
        </div>
      ),
    },
    {
      header: "Date",
      render: (row) => (
        <span className="text-stone-600">
          {row.sale_date ? format(new Date(row.sale_date), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      header: "Product",
      render: (row) => (
        <div className="max-w-48">
          <p className="font-medium text-stone-900 truncate">{row.product_name || row.sku || "-"}</p>
          <p className="text-sm text-stone-500">Qty: {row.quantity}</p>
        </div>
      ),
    },
    {
      header: "Gross",
      render: (row) => (
        <span className="font-medium text-stone-900">
          ${(row.gross_total || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Net",
      render: (row) => (
        <span className="font-medium text-emerald-600">
          ${(row.net_payout || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Job",
      render: (row) => {
        const job = jobs.find(j => j.id === row.job_id);
        if (job) {
          return (
            <Link
              to={createPageUrl("Jobs") + `?job=${job.id}`}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {job.job_number}
            </Link>
          );
        }
        return (
          <span className="text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            None
          </span>
        );
      },
    },
    {
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
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
              setEditingOrder(row);
              setFormOpen(true);
            }}>
              Edit Order
            </DropdownMenuItem>
            {!row.job_id && (
              <DropdownMenuItem asChild>
                <Link to={createPageUrl("Jobs") + `?create=true&order=${row.id}`}>
                  <Wrench className="w-4 h-4 mr-2" />
                  Create Job
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Manage your Etsy orders">
        <Button variant="outline" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button
          onClick={() => setImportOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Etsy CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_production">In Production</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="missing">Missing Job</SelectItem>
            <SelectItem value="linked">Has Job</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {orders.length === 0 && !isLoading ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Import your Etsy orders to start tracking revenue and profit."
          actionLabel="Import Etsy CSV"
          onAction={() => setImportOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredOrders}
          isLoading={isLoading}
          emptyMessage="No orders match your filters"
        />
      )}

      {/* Import Dialog */}
      <CSVImporter
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Etsy Orders"
        description="Upload your Etsy sales CSV. Existing orders will be updated, not duplicated."
        onImport={handleImport}
        parseRow={parseEtsyRow}
        getUniqueKey={(row) => `etsy-${row.order_id}`}
      />

      {/* Order Form Dialog */}
      <OrderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        order={editingOrder}
        onClose={() => {
          setFormOpen(false);
          setEditingOrder(null);
        }}
      />
    </div>
  );
}