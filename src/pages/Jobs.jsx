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
import { Plus, Search, MoreHorizontal, Wrench, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import JobFormDialog from "@/components/jobs/JobFormDialog";
import JobDetailSheet from "@/components/jobs/JobDetailSheet";

export default function Jobs() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const queryClient = useQueryClient();

  // Check URL params
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "true") {
      setFormOpen(true);
    }
  }, []);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list("-created_date"),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = !search ||
        job.job_number?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  const getOrdersForJob = (job) => {
    return orders.filter(o => job.order_ids?.includes(o.id));
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || "-";
  };

  const markComplete = (job) => {
    updateMutation.mutate({
      id: job.id,
      data: {
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    });
    
    // Update linked orders
    const jobOrders = getOrdersForJob(job);
    jobOrders.forEach(order => {
      base44.entities.Order.update(order.id, { status: "completed" });
    });
    
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const columns = [
    {
      header: "Job #",
      render: (row) => (
        <span className="font-mono font-medium text-stone-900">{row.job_number}</span>
      ),
    },
    {
      header: "Product",
      render: (row) => (
        <span className="text-stone-700">{getProductName(row.product_id)}</span>
      ),
    },
    {
      header: "Qty",
      render: (row) => <span className="text-stone-600">{row.quantity || 1}</span>,
    },
    {
      header: "Orders",
      render: (row) => {
        const jobOrders = getOrdersForJob(row);
        return (
          <span className="text-stone-600">{jobOrders.length} linked</span>
        );
      },
    },
    {
      header: "Total Cost",
      render: (row) => (
        <span className="font-medium text-stone-900">
          ${(row.total_cost || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Created",
      render: (row) => (
        <span className="text-stone-500 text-sm">
          {row.created_date ? format(new Date(row.created_date), "MMM d") : "-"}
        </span>
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
            <DropdownMenuItem onClick={() => setSelectedJob(row)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setEditingJob(row);
              setFormOpen(true);
            }}>
              Edit Job
            </DropdownMenuItem>
            {row.status !== "completed" && (
              <DropdownMenuItem onClick={() => markComplete(row)}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" description="Production jobs and cost tracking">
        <Button
          onClick={() => {
            setEditingJob(null);
            setFormOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Job
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search jobs..."
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
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {jobs.length === 0 && !isLoading ? (
        <EmptyState
          icon={Wrench}
          title="No jobs yet"
          description="Create production jobs to track costs and link orders."
          actionLabel="Create Job"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredJobs}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedJob(row)}
          emptyMessage="No jobs match your filters"
        />
      )}

      <JobFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        job={editingJob}
        onClose={() => {
          setFormOpen(false);
          setEditingJob(null);
        }}
      />

      <JobDetailSheet
        job={selectedJob}
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
      />
    </div>
  );
}