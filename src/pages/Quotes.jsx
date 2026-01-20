import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Wrench, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import QuoteFormDialog from "@/components/quotes/QuoteFormDialog";
import StatusBadge from "@/components/shared/StatusBadge";
import JobDetailSheet from "@/components/jobs/JobDetailSheet";
import { format } from "date-fns";

export default function QuotesPage() {
  const { user, loading } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [activeTab, setActiveTab] = useState("quotes");
  const [selectedJob, setSelectedJob] = useState(null);
  const queryClient = useQueryClient();

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Quote.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const { data: settings } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const list = await base44.entities.Settings.filter({ owner_user_id: user.id });
      return list.find(s => s.setting_key === "default") || null;
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Job.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Order.filter({ owner_user_id: user.id }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Product.filter({ owner_user_id: user.id }),
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const markJobComplete = async (job) => {
    await updateJobMutation.mutateAsync({
      id: job.id,
      data: {
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    });
    const jobOrders = orders.filter(o => job.order_ids?.includes(o.id));
    for (const order of jobOrders) {
      await base44.entities.Order.update(order.id, { status: "completed" });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const handleEdit = (quote) => {
    setSelectedQuote(quote);
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelectedQuote(null);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this quote?")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleQuoteSelection = (quoteId) => {
    setSelectedQuotes(prev =>
      prev.includes(quoteId)
        ? prev.filter(id => id !== quoteId)
        : [...prev, quoteId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedQuotes.length === quotes.length) {
      setSelectedQuotes([]);
    } else {
      setSelectedQuotes(quotes.map(q => q.id));
    }
  };

  const handleExportPDF = async (quote) => {
    const { exportQuoteToPDF } = await import("@/components/quotes/exportQuoteToPDF");
    exportQuoteToPDF(quote, settings?.business_name || "Your Business");
  };

  const columns = [
    {
      key: "select",
      label: (
        <input
          type="checkbox"
          checked={selectedQuotes.length === quotes.length && quotes.length > 0}
          onChange={toggleSelectAll}
          className="rounded border-stone-300"
        />
      ),
      render: (quote) => (
        <input
          type="checkbox"
          checked={selectedQuotes.includes(quote.id)}
          onChange={() => toggleQuoteSelection(quote.id)}
          className="rounded border-stone-300"
        />
      ),
    },
    {
      key: "quote_number",
      label: "Quote #",
      render: (quote) => (
        <span className="font-mono text-sm font-medium">{quote.quote_number}</span>
      ),
    },
    {
      key: "project_name",
      label: "Project",
      render: (quote) => (
        <div>
          <div className="font-medium">{quote.project_name}</div>
          <div className="text-xs text-stone-500">{quote.customer_name}</div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (quote) => <StatusBadge status={quote.status} />,
    },
    {
      key: "total",
      label: "Total",
      render: (quote) => (
        <span className="font-semibold">${(quote.total || 0).toFixed(2)}</span>
      ),
    },
    {
      key: "created_date",
      label: "Created",
      render: (quote) => format(new Date(quote.created_date), "MMM dd, yyyy"),
    },
    {
      key: "actions",
      label: "",
      render: (quote) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExportPDF(quote)}
          >
            <Download className="w-3 h-3 mr-1" />
            PDF
          </Button>
          {quote.status === "Accepted" && quote.converted_to_order_id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const job = jobs.find(j => j.order_ids?.includes(quote.converted_to_order_id));
                if (job) setSelectedJob(job);
              }}
            >
              View Job
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(quote)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDelete(quote.id)}
            className="text-rose-600 hover:text-rose-700"
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

  const getJobsForQuotes = () => {
    return jobs.filter(job => {
      const quote = quotes.find(q => q.converted_to_order_id && job.order_ids?.includes(q.converted_to_order_id));
      return !!quote;
    });
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || "-";
  };

  const jobColumns = [
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
      render: (job) => <span className="font-medium">${(job.depreciation_cost || 0).toFixed(2)}</span>,
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
        const variance = (job.total_cost || 0) - (job.depreciation_cost || 0);
        const isOver = variance > 0;
        return (
          <span className={isOver ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>
            ${Math.abs(variance).toFixed(2)} {isOver ? "over" : "under"}
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
      key: "actions",
      label: "",
      render: (job) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedJob(job)}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotes & Production"
        description="Manage quotes from estimate to production"
      >
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          New Quote
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="production">Production ({getJobsForQuotes().length})</TabsTrigger>
        </TabsList>

        <TabsContent value="quotes">
          <Card>
            <CardContent className="p-0">
              {quotes.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-stone-300 mb-3" />
                  <p className="text-stone-500 mb-4">No quotes yet</p>
                  <Button onClick={handleNew} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Quote
                  </Button>
                </div>
              ) : (
                <DataTable data={quotes} columns={columns} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production">
          <Card>
            <CardContent className="p-0">
              {getJobsForQuotes().length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 mx-auto text-stone-300 mb-3" />
                  <p className="text-stone-500 mb-4">No production jobs yet</p>
                  <p className="text-stone-400 text-sm">Accept a quote to create a production job</p>
                </div>
              ) : (
                <DataTable data={getJobsForQuotes()} columns={jobColumns} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <QuoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        quote={selectedQuote}
      />

      <JobDetailSheet
        job={selectedJob}
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
      />
    </div>
  );
}