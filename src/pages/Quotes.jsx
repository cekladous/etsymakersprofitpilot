import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, FileCheck, Copy, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import QuoteFormDialog from "@/components/quotes/QuoteFormDialog";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

export default function QuotesPage() {
  const { user, loading } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Quote.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (quote) => {
      const newQuote = {
        ...quote,
        id: undefined,
        quote_number: `Q-${Date.now()}`,
        status: "Draft",
        created_date: new Date().toISOString(),
      };
      return base44.entities.Quote.create(newQuote);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: async (quoteId) => {
      const result = await base44.functions.invoke('convertQuoteToInvoice', { quoteId });
      return result.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Invoice Created",
        description: `Invoice ${result.invoice.invoice_number} created successfully.`,
      });
      navigate(`/Invoices`);
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

  const handleDuplicate = (quote) => {
    duplicateMutation.mutate(quote);
  };

  const handleConvertToInvoice = (quote) => {
    if (quote.status === "Invoiced" || quote.status === "Paid") {
      toast({
        title: "Already Invoiced",
        description: "This quote has already been converted to an invoice.",
        variant: "destructive",
      });
      return;
    }
    if (quote.status !== "Accepted") {
      toast({
        title: "Quote Not Accepted",
        description: "Please mark the quote as Accepted before converting to invoice.",
        variant: "destructive",
      });
      return;
    }
    convertToInvoiceMutation.mutate(quote.id);
  };

  const columns = [
    {
      key: "quote_number",
      label: "Quote #",
      render: (quote) => (
        <span className="font-mono text-sm font-medium">{quote.quote_number}</span>
      ),
    },
    {
      key: "customer_name",
      label: "Client",
      render: (quote) => (
        <div>
          <div className="font-medium">{quote.customer_name}</div>
          {quote.customer_email && (
            <div className="text-xs text-stone-500">{quote.customer_email}</div>
          )}
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
      key: "due_date",
      label: "Due Date",
      render: (quote) => quote.due_date ? format(new Date(quote.due_date), "MMM dd, yyyy") : "—",
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
            onClick={() => handleDuplicate(quote)}
            disabled={duplicateMutation.isPending}
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleConvertToInvoice(quote)}
            disabled={convertToInvoiceMutation.isPending || quote.status === "Invoiced" || quote.status === "Paid" || quote.status !== "Accepted"}
            className="text-emerald-600 hover:text-emerald-700 border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
            title={quote.status !== "Accepted" ? "Quote must be Accepted first" : "Convert to Invoice"}
          >
            <FileCheck className="w-3 h-3 mr-1" />
            Invoice
          </Button>
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
            <Trash2 className="w-3 h-3" />
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
        description="Create and manage price quotes for clients"
      >
        <Button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          New Quote
        </Button>
      </PageHeader>

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