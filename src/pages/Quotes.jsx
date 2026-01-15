import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import QuoteFormDialog from "@/components/quotes/QuoteFormDialog";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";

export default function QuotesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const queryClient = useQueryClient();

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => base44.entities.Quote.list("-created_date"),
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const list = await base44.entities.Settings.list();
      return list.find(s => s.setting_key === "default") || null;
    },
  });

  const convertToOrderMutation = useMutation({
    mutationFn: async (quote) => {
      // Create order from quote
      const order = await base44.entities.Order.create({
        channel: "custom",
        order_id: `QUOTE-${quote.quote_number}`,
        sale_date: new Date().toISOString().split("T")[0],
        product_name: quote.project_name,
        gross_total: quote.total,
        shipping_charged: 0,
        discounts: 0,
        refunds: 0,
        sales_tax: quote.tax_amount,
        net_payout: quote.subtotal,
        status: "pending",
        notes: `Converted from Quote #${quote.quote_number} - Customer: ${quote.customer_name}`,
      });

      // Update quote status
      await base44.entities.Quote.update(quote.id, {
        status: "Accepted",
        converted_to_order_id: order.id,
      });

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
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

  const handleConvertToOrder = (quote) => {
    if (confirm(`Convert Quote #${quote.quote_number} to an order?`)) {
      convertToOrderMutation.mutate(quote);
    }
  };

  const handleDelete = (id) => {
    if (confirm("Delete this quote?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleExportPDF = async (quote) => {
    const { exportQuoteToPDF } = await import("@/components/quotes/exportQuoteToPDF");
    exportQuoteToPDF(quote, settings?.business_name || "Your Business");
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
          {quote.status === "Accepted" && !quote.converted_to_order_id && (
            <Button
              size="sm"
              onClick={() => handleConvertToOrder(quote)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Convert to Order
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

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Create and manage customer quotes"
      >
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
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