import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import QuoteFormDialog from "@/components/quotes/QuoteFormDialog";
import BulkQuoteActions from "@/components/quotes/BulkQuoteActions";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";

export default function QuotesPage() {
  const { user, loading } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedQuotes, setSelectedQuotes] = useState([]);
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



  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Manage client quotes and estimates"
      >
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          New Quote
        </Button>
      </PageHeader>

      {selectedQuotes.length > 0 && (
        <BulkQuoteActions 
          selectedQuotes={selectedQuotes} 
          quotes={quotes}
          settings={settings}
        />
      )}

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

      <QuoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        quote={selectedQuote}
      />
    </div>
  );
}