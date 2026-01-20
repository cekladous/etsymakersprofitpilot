import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import JobDetailSheet from "@/components/jobs/JobDetailSheet";
import JobKanbanView from "@/components/jobs/JobKanbanView";
import JobSpreadsheetView from "@/components/jobs/JobSpreadsheetView";
import JobFormDialog from "@/components/jobs/JobFormDialog";
import ProductionEntryDialog from "@/components/quotes/ProductionEntryDialog";
import { format } from "date-fns";
import { Wrench, TrendingUp, DollarSign, Plus, Search, List, LayoutGrid, TableIcon, MoreHorizontal, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ProductionPage() {
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState("list"); // list, kanban, spreadsheet
  const [selectedJob, setSelectedJob] = useState(null);
  const [productionEntryOpen, setProductionEntryOpen] = useState(false);
  const [jobForProduction, setJobForProduction] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "true") {
      setFormOpen(true);
    }
  }, []);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Job.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Product.filter({ owner_user_id: user.id }),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Order.filter({ owner_user_id: user.id }),
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || "-";
  };

  const getOrdersForJob = (job) => {
    return orders.filter(o => job.order_ids?.includes(o.id));
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = !search ||
        job.job_number?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  const markComplete = async (job) => {
    await updateJobMutation.mutateAsync({
      id: job.id,
      data: {
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    });
    
    const jobOrders = getOrdersForJob(job);
    for (const order of jobOrders) {
      await base44.entities.Order.update(order.id, { status: "completed" });
    }
    
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
  };

  // KPI calculations
  const totalJobs = jobs.length;
  const inProgressJobs = jobs.filter(j => j.status === "in_progress").length;
  const totalVariance = jobs.reduce((sum, job) => {
    return sum + ((job.total_cost || 0) - (job.quoted_total_cost || 0));
  }, 0);

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
      header: "Quoted",
      render: (row) => (
        <span className="font-medium text-stone-900">
          ${(row.quoted_total_cost || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Actual",
      render: (row) => (
        <span className="font-medium text-stone-900">
          ${(row.total_cost || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Variance",
      render: (row) => {
        const variance = (row.total_cost || 0) - (row.quoted_total_cost || 0);
        const isOver = variance > 0;
        return (
          <span className={isOver ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>
            ${Math.abs(variance).toFixed(2)}
          </span>
        );
      },
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
            <DropdownMenuItem onClick={() => {
              setJobForProduction(row);
              setProductionEntryOpen(true);
            }}>
              Log Entry
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

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;
  }

  return (
    <div>
      <PageHeader
        title="Production Dashboard"
        description="Track jobs, costs, and production workflow"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-600 mb-1">Total Jobs</p>
                <p className="text-3xl font-bold">{totalJobs}</p>
              </div>
              <Wrench className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold">{inProgressJobs}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-600 mb-1">Total Variance</p>
                <p className={`text-3xl font-bold ${totalVariance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  ${Math.abs(totalVariance).toFixed(0)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-stone-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 mx-auto text-stone-300 mb-3" />
                  <p className="text-stone-500 mb-2">No production jobs yet</p>
                  <p className="text-stone-400 text-sm">Jobs created from accepted quotes will appear here</p>
                </div>
              ) : (
                <DataTable data={jobs} columns={columns} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="w-12 h-12 mx-auto text-stone-300 mb-3" />
                <p className="text-stone-500">No production jobs yet</p>
              </CardContent>
            </Card>
          ) : (
            <JobKanbanView
              jobs={jobs}
              onJobClick={setSelectedJob}
              onStatusChange={(jobId, newStatus) => {
                const job = jobs.find(j => j.id === jobId);
                if (job) {
                  updateJobMutation.mutate({
                    id: jobId,
                    data: {
                      status: newStatus,
                      ...(newStatus === "completed" && { completed_at: new Date().toISOString() }),
                    },
                  });
                }
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <JobDetailSheet
        job={selectedJob}
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
      />

      <ProductionEntryDialog
        job={jobForProduction}
        open={productionEntryOpen}
        onOpenChange={setProductionEntryOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }}
      />
    </div>
  );
}