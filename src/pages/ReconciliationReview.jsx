import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileText, Download, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import { format } from "date-fns";

export default function ReconciliationReview() {
  const [selectedIds, setSelectedIds] = useState([]);
  const queryClient = useQueryClient();
  const { data: imports = [] } = useQuery({
    queryKey: ["etsy-statement-imports"],
    queryFn: () => base44.entities.EtsyStatementImport.list("-imported_at"),
  });

  const { data: unmatchedStatementLines = [] } = useQuery({
    queryKey: ["unmatched-statement-lines"],
    queryFn: async () => {
      const all = await base44.entities.EtsyStatementLine.list("-transaction_date", 1000);
      return all.filter(line => !line.matched);
    },
  });

  const { data: unmatchedLedgerEntries = [] } = useQuery({
    queryKey: ["unmatched-ledger-entries"],
    queryFn: async () => {
      const all = await base44.entities.EtsyLedgerEntry.list("-entry_date", 5000);
      return all.filter(e => e.status === "Unmatched" || !e.matched_category);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (items) => {
      const deletePromises = items.map(async (item) => {
        if (item.source === "New Import") {
          await base44.entities.EtsyStatementLine.delete(item.id);
        } else {
          await base44.entities.EtsyLedgerEntry.delete(item.id);
        }
      });
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-statement-lines"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-ledger-entries"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-imports"] });
      setSelectedIds([]);
    },
  });

  const columns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.length === allUnmatchedRows.length && allUnmatchedRows.length > 0}
          onChange={() => {
            if (selectedIds.length === allUnmatchedRows.length) {
              setSelectedIds([]);
            } else {
              setSelectedIds(allUnmatchedRows);
            }
          }}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.some(item => item.id === row.id)}
          onChange={() => {
            const isSelected = selectedIds.some(item => item.id === row.id);
            if (isSelected) {
              setSelectedIds(selectedIds.filter(item => item.id !== row.id));
            } else {
              setSelectedIds([...selectedIds, row]);
            }
          }}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
    },
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
      header: "Source",
      render: (row) => (
        <Badge variant="outline" className="text-xs">
          {row.source}
        </Badge>
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

  const totalUnmatched = unmatchedStatementLines.length + unmatchedLedgerEntries.length;

  // Combine both sources for display
  const allUnmatchedRows = [
    ...unmatchedStatementLines.map(line => ({
      id: line.id,
      transaction_date: line.transaction_date,
      type: line.type,
      description: line.description,
      amount: line.amount,
      match_error: line.match_error,
      source: "New Import"
    })),
    ...unmatchedLedgerEntries.map(entry => ({
      id: entry.id,
      transaction_date: entry.entry_date,
      type: entry.type,
      description: entry.title || entry.info,
      amount: entry.amount || entry.net,
      match_error: "Legacy unmatched entry",
      source: "Legacy Data"
    }))
  ];

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
            {selectedIds.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-emerald-900">
                  {selectedIds.length} row{selectedIds.length !== 1 ? "s" : ""} selected
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Delete ${selectedIds.length} unmatched row(s)?`)) {
                      bulkDeleteMutation.mutate(selectedIds);
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
            <DataTable
              columns={columns}
              data={allUnmatchedRows}
              emptyMessage="No unmatched rows"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}