import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { FileText, CheckCircle2, Download, Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";

const paymentStatusConfig = {
  Unpaid: { className: "bg-amber-100 text-amber-700 border-amber-200" },
  Partial: { className: "bg-blue-100 text-blue-700 border-blue-200" },
  Paid: { className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const statusConfig = {
  Sent: { className: "bg-blue-100 text-blue-700 border-blue-200" },
  Paid: { className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  Partial: { className: "bg-blue-100 text-blue-700 border-blue-200" },
  Overdue: { className: "bg-rose-100 text-rose-700 border-rose-200" },
  Cancelled: { className: "bg-stone-100 text-stone-400 border-stone-200 line-through" },
};

export default function InvoicesPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [markingId, setMarkingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Invoice.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (invoice) => {
      if (!invoice.custom_sale_id) {
        const saleDate = invoice.invoice_date || new Date().toISOString().split('T')[0];
        const customSale = await base44.entities.CustomSale.create({
          owner_user_id: user.id,
          date: saleDate,
          vendor: invoice.customer_name || '',
          description: `${invoice.project_name || 'Invoice'} — ${invoice.invoice_number || ''}`,
          payment_source: invoice.payment_method || 'Other',
          pre_tax_amount: invoice.subtotal || 0,
          sales_tax_collected: invoice.tax_amount || 0,
          gross_sale: invoice.total || 0,
          shipping_or_postage_cost: invoice.shipping_cost || 0,
          notes: `Auto-created from invoice ${invoice.invoice_number || ''}`
        });
        await base44.entities.Invoice.update(invoice.id, {
          status: "Paid",
          amount_paid: invoice.total || 0,
          balance_due: 0,
          custom_sale_id: customSale.id,
        });
      } else {
        await base44.entities.Invoice.update(invoice.id, {
          status: "Paid",
          amount_paid: invoice.total || 0,
          balance_due: 0,
        });
      }
    },
    onSuccess: () => {
      toast({ 
        title: "Invoice marked as Paid", 
        description: "Invoice has been updated successfully." 
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
    },
  });

  const handleMarkAsPaid = (invoice) => {
    setMarkingId(invoice.id);
    markAsPaidMutation.mutate(invoice, {
      onSettled: () => setMarkingId(null),
    });
  };

  const handleEdit = (invoice) => {
    setSelectedInvoice(invoice);
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelectedInvoice(null);
    setFormOpen(true);
  };

  const handleDownloadPDF = async (invoice) => {
    toast({ title: "PDF Download", description: "Invoice PDF will be downloaded shortly." });
  };

  const columns = [
    {
      key: "invoice_number",
      label: "Invoice #",
      render: (inv) => (
        <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
      ),
    },
    {
      key: "customer_name",
      label: "Client",
      render: (inv) => (
        <div>
          <div className="font-medium">{inv.customer_name}</div>
          {inv.customer_email && (
            <div className="text-xs text-stone-500">{inv.customer_email}</div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (inv) => {
        const config = statusConfig[inv.status] || {};
        return (
          <Badge variant="outline" className={config.className}>
            {inv.status || "Sent"}
          </Badge>
        );
      },
    },
    {
      key: "payment_status",
      label: "Payment",
      render: (inv) => {
        const paymentStatus = inv.balance_due <= 0 ? "Paid" : inv.amount_paid > 0 ? "Partial" : "Unpaid";
        const config = paymentStatusConfig[paymentStatus] || {};
        return (
          <Badge variant="outline" className={config.className}>
            {paymentStatus}
          </Badge>
        );
      },
    },
    {
      key: "total",
      label: "Total",
      render: (inv) => (
        <span className="font-semibold">${(inv.total || 0).toFixed(2)}</span>
      ),
    },
    {
      key: "balance_due",
      label: "Balance Due",
      render: (inv) => (
        <span className={inv.balance_due > 0 ? "font-medium text-rose-600" : "text-stone-500"}>
          ${(inv.balance_due || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "invoice_date",
      label: "Date",
      render: (inv) => inv.invoice_date ? format(new Date(inv.invoice_date), "MMM dd, yyyy") : "—",
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (inv) => inv.due_date ? format(new Date(inv.due_date), "MMM dd, yyyy") : "—",
    },
    {
      key: "actions",
      label: "",
      render: (inv) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDownloadPDF(inv)}
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(inv)}
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={inv.status === "Paid" || markingId === inv.id}
            onClick={() => handleMarkAsPaid(inv)}
            className="gap-1.5 text-emerald-600 hover:text-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4" />
            {markingId === inv.id ? "Marking..." : "Mark Paid"}
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
        title="Invoices"
        description="Track invoices and monitor payment status"
      />

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-stone-300 mb-3" />
              <p className="text-stone-500 mb-2">No invoices yet</p>
              <p className="text-sm text-stone-400">
                Convert a quote to an invoice from the Quotes page
              </p>
            </div>
          ) : (
            <DataTable data={invoices} columns={columns} />
          )}
        </CardContent>
      </Card>

      <InvoiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        invoice={selectedInvoice}
      />
    </div>
  );
}