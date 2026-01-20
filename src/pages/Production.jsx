import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import JobDetailSheet from "@/components/jobs/JobDetailSheet";
import JobKanbanView from "@/components/jobs/JobKanbanView";
import ProductionEntryDialog from "@/components/quotes/ProductionEntryDialog";
import { format } from "date-fns";
import { Wrench, TrendingUp, DollarSign } from "lucide-react";

export default function ProductionPage() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState("list");
  const [selectedJob, setSelectedJob] = useState(null);
  const [productionEntryOpen, setProductionEntryOpen] = useState(false);
  const [jobForProduction, setJobForProduction] = useState(null);
  const queryClient = useQueryClient();

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

  // KPI calculations
  const totalJobs = jobs.length;
  const inProgressJobs = jobs.filter(j => j.status === "in_progress").length;
  const totalVariance = jobs.reduce((sum, job) => {
    return sum + ((job.total_cost || 0) - (job.quoted_total_cost || 0));
  }, 0);

  const columns = [
    {
      key: "job_number",
      label: "Job #",
      render: (job) => <span className="font-mono text-sm font-medium">{job.job_number}</span>,
    },
    {
      key: "product",
      label: "Product",
      render: (job) => <span className="text-stone-700">{getProductName(job.product_id)}</span>,
    },
    {
      key: "quantity",
      label: "Qty",
      render: (job) => <span className="text-stone-600">{job.quantity || 1}</span>,
    },
    {
      key: "quoted_cost",
      label: "Quoted Cost",
      render: (job) => <span className="font-medium">${(job.quoted_total_cost || 0).toFixed(2)}</span>,
    },
    {
      key: "actual_cost",
      label: "Actual Cost",
      render: (job) => <span className="font-medium">${(job.total_cost || 0).toFixed(2)}</span>,
    },
    {
      key: "variance",
      label: "Variance",
      render: (job) => {
        const variance = (job.total_cost || 0) - (job.quoted_total_cost || 0);
        const isOver = variance > 0;
        const variancePercent = job.quoted_total_cost > 0 
          ? ((job.total_cost || 0) / (job.quoted_total_cost || 1) * 100)
          : 0;
        return (
          <span className={isOver ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>
            ${Math.abs(variance).toFixed(2)} ({variancePercent.toFixed(0)}%)
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (job) => <StatusBadge status={job.status} />,
    },
    {
      key: "created_date",
      label: "Created",
      render: (job) => format(new Date(job.created_date), "MMM dd, yyyy"),
    },
    {
      key: "actions",
      label: "",
      render: (job) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setJobForProduction(job);
              setProductionEntryOpen(true);
            }}
          >
            Log Entry
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedJob(job)}
          >
            Details
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