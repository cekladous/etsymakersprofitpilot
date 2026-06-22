import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

const paymentStatusConfig = {
  Unpaid: { className: "bg-amber-100 text-amber-700 border-amber-200" },
  Partial: { className: "bg-blue-100 text-blue-700 border-blue-200" },
  Paid: { className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const lifecycleStatusConfig = {
  Draft: { className: "bg-stone-100 text-stone-600 border-stone-200" },
  Sent: { className: "bg-blue-100 text-blue-700 border-blue-200" },
  Paid: { className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  Overdue: { className: "bg-rose-100 text-rose-700 border-rose-200" },
  Void: { className: "bg-stone-100 text-stone-400 border-stone-200 line-through" },
};

export default function InvoicesPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [markingId, setMarkingId] = useState(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Invoice.filter({ owner_user_id: user.id }, "-created_date"),
  });

  const handleMarkAsPaid = async (invoice) => {
    setMarkingId(invoice.id);
    try {
      await base44.entities.Invoice.update(invoice.id, {
        status: "Paid",
        amount_paid: invoice.total || 0,
        balance_due: 0,
      });
      toast({ title: "Invoice marked as Paid", description: "A custom sale record will be created automatically." });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customSales"] });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setMarkingId(null);
    }
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
      label: "Customer",
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
      key: "issue_date",
      label: "Issued",
      render: (inv) => inv.issue_date ? format(new Date(inv.issue_date), "MMM dd, yyyy") : "—",
    },
    {
      key: "due_date",
      label: "Due",
      render: (inv) => inv.due_date ? format(new Date(inv.due_date), "MMM dd, yyyy") : "—",
    },
    {
      key: "payment_status",
      label: "Payment",
      render: (inv) => {
        const config = paymentStatusConfig[inv.payment_status] || {};
        return (
          <Badge variant="outline" className={config.className}>
            {inv.payment_status || "Unpaid"}
          </Badge>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (inv) => {
        const config = lifecycleStatusConfig[inv.status] || {};
        return (
          <Badge variant="outline" className={config.className}>
            {inv.status || "Draft"}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (inv) => (
        <Button
          size="sm"
          variant="outline"
          disabled={inv.status === "Paid" || markingId === inv.id}
          onClick={(e) => {
            e.stopPropagation();
            handleMarkAsPaid(inv);
          }}
          className="gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          {markingId === inv.id ? "Marking..." : "Mark Paid"}
        </Button>
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
        description="Track invoices converted from quotes and monitor payment status"
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
    </div>
  );
}