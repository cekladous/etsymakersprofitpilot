import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileText, Download } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import { format } from "date-fns";

export default function ReconciliationReview() {
  const { data: imports = [] } = useQuery({
    queryKey: ["etsy-statement-imports"],
    queryFn: () => base44.entities.EtsyStatementImport.list("-imported_at"),
  });

  const { data: unmatchedLines = [] } = useQuery({
    queryKey: ["unmatched-lines"],
    queryFn: async () => {
      const all = await base44.entities.EtsyStatementLine.list("-transaction_date", 1000);
      return all.filter(line => !line.matched);
    },
  });

  const columns = [
    {
      header: "Date",
      render: (row) => row.transaction_date || "—",
    },
    {
      header: "Type",
      render: (row) => row.type,
    },
    {
      header: "Description",
      render: (row) => (
        <div className="max-w-xs truncate">
          {row.description}
        </div>
      ),
    },
    {
      header: "Amount",
      render: (row) => (
        <span className="font-medium">
          ${row.amount?.toFixed(2) || "0.00"}
        </span>
      ),
    },
    {
      header: "Error",
      render: (row) => (
        <span className="text-rose-600 text-sm">
          {row.match_error || "Unknown"}
        </span>
      ),
    },
  ];

  const importColumns = [
    {
      header: "Statement Month",
      render: (row) => (
        <div>
          <p className="font-semibold text-stone-900">{row.statement_month}</p>
          <p className="text-xs text-stone-500">
            {row.date_range_start} to {row.date_range_end}
          </p>
        </div>
      ),
    },
    {
      header: "Imported",
      render: (row) => (
        <span className="text-sm text-stone-600">
          {format(new Date(row.imported_at), "MMM d, yyyy HH:mm")}
        </span>
      ),
    },
    {
      header: "Orders",
      render: (row) => row.orders_count || 0,
    },
    {
      header: "Fees",
      render: (row) => row.fees_count || 0,
    },
    {
      header: "Deposits",
      render: (row) => row.deposits_count || 0,
    },
    {
      header: "Unmatched",
      render: (row) => (
        <span className={row.unmatched_count > 0 ? "text-amber-600 font-semibold" : "text-stone-600"}>
          {row.unmatched_count || 0}
        </span>
      ),
    },
    {
      header: "Status",
      render: (row) => {
        const status = row.reconciliation_status || "PENDING";
        return (
          <Badge
            className={
              status === "PASS"
                ? "bg-emerald-100 text-emerald-800"
                : status === "FAIL"
                ? "bg-rose-100 text-rose-800"
                : "bg-amber-100 text-amber-800"
            }
          >
            {status}
          </Badge>
        );
      },
    },
  ];

  const totalUnmatched = unmatchedLines.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Reconciliation Review"
        description="Review imports and resolve unmatched statement lines"
      />

      {totalUnmatched > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">
                  {totalUnmatched} rows need review
                </p>
                <p className="text-sm text-amber-700">
                  These statement lines could not be automatically matched or categorized.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {totalUnmatched === 0 && imports.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">
                  All imports reconciled
                </p>
                <p className="text-sm text-emerald-700">
                  No unmatched rows found across all statement imports.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={importColumns}
            data={imports}
            emptyMessage="No statement imports yet"
          />
        </CardContent>
      </Card>

      {totalUnmatched > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Unmatched Rows ({totalUnmatched})</span>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export for Review
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={unmatchedLines}
              emptyMessage="No unmatched rows"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}