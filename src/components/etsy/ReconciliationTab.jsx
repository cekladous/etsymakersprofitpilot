import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Download, Trash2, ChevronDown, ChevronRight, Check } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import DepositMatcher from "@/components/reconciliation/DepositMatcher";
import StatementSummary from "@/components/etsy/StatementSummary";
import { classifyEtsyLedgerEntry } from "@/components/shared/financialAggregator";
import { format } from "date-fns";

// Extract dollar amount from a description like "$73.11 sent to your bank account"
const parseAmountFromDescription = (desc) => {
  if (!desc) return 0;
  const match = desc.match(/\$?\s*([\d,]+\.\d{2})/);
  if (match) return parseFloat(match[1].replace(/,/g, ""));
  const match2 = desc.match(/\$?\s*([\d,]+)/);
  if (match2) return parseFloat(match2[1].replace(/,/g, ""));
  return 0;
};

// Short, human-readable reason for why a row is unmatched
const simplifyError = (row) => {
  const err = row.match_error || "";
  if (err.startsWith("Unknown pattern")) {
    if (row.type === "Deposit") return "Deposit not linked to statement";
    if (row.type === "Payment") return "Payment not categorized";
    return "Not categorized";
  }
  if (err === "Legacy unmatched entry") return "Legacy data — needs review";
  return err || "Needs review";
};

export default function ReconciliationTab({ user }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const queryClient = useQueryClient();

  const { data: imports = [] } = useQuery({
    queryKey: ["etsy-statement-imports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementImport.filter({ owner_user_id: user.id }, "-imported_at"),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Transfer.filter({ owner_user_id: user.id, type: "etsy_deposit" }, "-date", 1000),
  });

  const { data: unmatchedStatementLines = [] } = useQuery({
    queryKey: ["unmatched-statement-lines", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [allLines, allTransfers] = await Promise.all([
        base44.entities.EtsyStatementLine.filter({ owner_user_id: user.id }, "-transaction_date", 1000),
        base44.entities.Transfer.filter({ owner_user_id: user.id, type: "etsy_deposit" }, "-date", 1000),
      ]);

      const unmatched = allLines.filter(line => !line.matched);
      const stillUnmatched = [];

      for (const line of unmatched) {
        // Auto-match deposit lines to existing Transfer records by date + amount.
        // Both originate from the same Etsy Payment Account CSV but were never linked.
        if (line.type === "Deposit" || (line.description || "").toLowerCase().includes("sent to your bank")) {
          const lineAmount = line.amount || parseAmountFromDescription(line.description);
          const match = allTransfers.find(t => {
            if (!t.date || !line.transaction_date) return false;
            const dateClose = Math.abs(new Date(t.date) - new Date(line.transaction_date)) <= 7 * 24 * 60 * 60 * 1000;
            const amountClose = Math.abs((t.amount || 0) - lineAmount) < 0.50;
            return dateClose && amountClose;
          });
          if (match) {
            base44.entities.EtsyStatementLine.update(line.id, {
              matched: true,
              matched_entity_id: match.id,
              matched_entity_type: "Transfer",
              resolution_status: "auto_matched",
              category: "deposit",
            }).catch(() => {});
            continue; // skip — don't include in unmatched list
          }
        }
        stillUnmatched.push(line);
      }
      return stillUnmatched;
    },
  });

  const { data: unmatchedLedgerEntries = [] } = useQuery({
    queryKey: ["unmatched-ledger-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const all = await base44.entities.EtsyLedgerEntry.filter({ owner_user_id: user.id }, "-entry_date", 5000);
      const unmatched = all.filter(e => e.status === "Unmatched" || !e.matched_category);
      const stillUnmatched = [];
      for (const entry of unmatched) {
        const classification = classifyEtsyLedgerEntry(entry);
        if (classification.status === "Matched" && classification.category) {
          base44.entities.EtsyLedgerEntry.update(entry.id, {
            matched_category: classification.category,
            status: "Matched",
          }).catch(() => {});
        } else {
          stillUnmatched.push(entry);
        }
      }
      return stillUnmatched;
    },
  });

  const bulkResolveMutation = useMutation({
    mutationFn: async (items) => {
      const promises = items.map(async (item) => {
        if (item.source === "New Import") {
          await base44.entities.EtsyStatementLine.update(item.id, {
            matched: true,
            resolution_status: "approved_for_exclusion",
            category: item.type === "Payment" ? "sale" : "unmatched",
            resolution_notes: "Marked as resolved — redundant payment line",
            resolved_at: new Date().toISOString(),
          });
        } else {
          await base44.entities.EtsyLedgerEntry.update(item.id, {
            status: "Matched",
            matched_category: "resolved",
            notes: "Marked as resolved — redundant payment line",
          });
        }
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-statement-lines"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-ledger-entries"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-imports"] });
      setSelectedIds([]);
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

  const activeImports = imports.filter(imp => imp.status !== "replaced");

  // Consolidate imports by statement_month — merges the partial (PENDING) and
  // full (PASS) rows that the import process creates for the same month.
  const consolidatedImports = useMemo(() => {
    const byMonth = {};
    activeImports.forEach(imp => {
      const month = imp.statement_month;
      if (!byMonth[month]) {
        byMonth[month] = { ...imp };
      } else {
        const ex = byMonth[month];
        ex.orders_count = (ex.orders_count || 0) + (imp.orders_count || 0);
        ex.fees_count = (ex.fees_count || 0) + (imp.fees_count || 0);
        ex.deposits_count = (ex.deposits_count || 0) + (imp.deposits_count || 0);
        ex.unmatched_count = (ex.unmatched_count || 0) + (imp.unmatched_count || 0);
        // Wider date range
        if (imp.date_range_end && (!ex.date_range_end || imp.date_range_end > ex.date_range_end)) {
          ex.date_range_end = imp.date_range_end;
        }
        if (imp.date_range_start && (!ex.date_range_start || imp.date_range_start < ex.date_range_start)) {
          ex.date_range_start = imp.date_range_start;
        }
        // Most recent import time
        if (imp.imported_at > ex.imported_at) ex.imported_at = imp.imported_at;
        // Best status
        if (imp.reconciliation_status === "PASS") ex.reconciliation_status = "PASS";
      }
    });
    return Object.values(byMonth).sort((a, b) => b.statement_month.localeCompare(a.statement_month));
  }, [imports]);

  const unmatchedFromImports = consolidatedImports.reduce((sum, imp) => sum + (imp.unmatched_count || 0), 0);
  const totalUnmatched = Math.max(unmatchedFromImports, unmatchedStatementLines.length + unmatchedLedgerEntries.length);

  const importMonthMap = {};
  imports.forEach(imp => { importMonthMap[imp.id] = imp.statement_month; });

  const allUnmatchedRows = [
    ...unmatchedStatementLines.map(line => ({
      id: line.id,
      transaction_date: line.transaction_date,
      type: line.type,
      description: line.description,
      amount: line.amount || parseAmountFromDescription(line.description),
      match_error: line.match_error,
      import_month: importMonthMap[line.import_id] || "—",
      source: "New Import",
    })),
    ...unmatchedLedgerEntries.map(entry => ({
      id: entry.id,
      transaction_date: entry.entry_date,
      type: entry.type,
      description: entry.title || entry.info,
      amount: entry.amount || entry.net || parseAmountFromDescription(entry.title),
      match_error: "Legacy unmatched entry",
      import_month: "—",
      source: "Legacy Data",
    })),
  ];

  const columns = [
    {
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.length === allUnmatchedRows.length && allUnmatchedRows.length > 0}
          onChange={() => {
            if (selectedIds.length === allUnmatchedRows.length) setSelectedIds([]);
            else setSelectedIds(allUnmatchedRows);
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
            if (isSelected) setSelectedIds(selectedIds.filter(item => item.id !== row.id));
            else setSelectedIds([...selectedIds, row]);
          }}
          className="w-4 h-4 rounded border-stone-300"
        />
      ),
    },
    {
      header: "Date",
      render: (row) => <span className="text-stone-600">{row.transaction_date || "—"}</span>,
    },
    {
      header: "Type",
      render: (row) => (
        <Badge variant="outline" className="text-xs">
          {row.type}
        </Badge>
      ),
    },
    {
      header: "Description",
      render: (row) => (
        <div className="max-w-xs truncate text-stone-700">{row.description}</div>
      ),
    },
    {
      header: "Amount",
      render: (row) => (
        <span className="font-semibold text-stone-900">${(row.amount || 0).toFixed(2)}</span>
      ),
    },
    {
      header: "Month",
      render: (row) => <span className="text-stone-500 text-sm">{row.import_month || "—"}</span>,
    },
    {
      header: "Reason",
      render: (row) => (
        <span className="text-amber-600 text-sm">{simplifyError(row)}</span>
      ),
    },
  ];

  const importColumns = [
    {
      header: "Statement Month",
      render: (row) => (
        <div>
          <p className="font-semibold text-stone-900">{row.statement_month}</p>
          <p className="text-xs text-stone-500">{row.date_range_start} to {row.date_range_end}</p>
        </div>
      ),
    },
    {
      header: "Imported",
      render: (row) => (
        <span className="text-sm text-stone-600">{format(new Date(row.imported_at), "MMM d, yyyy")}</span>
      ),
    },
    { header: "Orders", render: (row) => row.orders_count || 0 },
    { header: "Fees", render: (row) => row.fees_count || 0 },
    { header: "Deposits", render: (row) => row.deposits_count || 0 },
    {
      header: "Unmatched",
      render: (row) => (
        <span className={row.unmatched_count > 0 ? "text-amber-600 font-semibold" : "text-stone-500"}>
          {row.unmatched_count || 0}
        </span>
      ),
    },
    {
      header: "Status",
      render: (row) => {
        const status = row.reconciliation_status || "PENDING";
        return (
          <Badge className={status === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
            {status}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <StatementSummary user={user} />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-stone-900">Deposit Matching</h3>
        <DepositMatcher user={user} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-stone-900">Statement Review</h3>

        {totalUnmatched > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">{totalUnmatched} rows need review</p>
              <p className="text-sm text-amber-700">These lines could not be automatically matched. See the table below.</p>
            </div>
          </div>
        )}

        {totalUnmatched === 0 && imports.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">All imports reconciled</p>
              <p className="text-sm text-emerald-700">No unmatched rows found.</p>
            </div>
          </div>
        )}

        {/* Import History — consolidated by month */}
        <Card>
          <CardHeader><CardTitle>Import History</CardTitle></CardHeader>
          <CardContent>
            {consolidatedImports.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-stone-600 mb-2">No imports yet</p>
                <p className="text-sm text-stone-500">Import an Etsy statement CSV from the Orders tab</p>
              </div>
            ) : (
              <DataTable columns={importColumns} data={consolidatedImports} emptyMessage="No statement imports yet" />
            )}
          </CardContent>
        </Card>

        {/* Unmatched Rows Table */}
        {totalUnmatched > 0 && allUnmatchedRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Unmatched Rows ({allUnmatchedRows.length})</span>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export for Review
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedIds.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-emerald-900">
                    {selectedIds.length} row{selectedIds.length !== 1 ? "s" : ""} selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bulkResolveMutation.mutate(selectedIds)}
                      disabled={bulkResolveMutation.isPending}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Mark as Resolved
                    </Button>
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
                </div>
              )}
              <DataTable columns={columns} data={allUnmatchedRows} emptyMessage="No unmatched rows" />
            </CardContent>
          </Card>
        )}

        {totalUnmatched > 0 && allUnmatchedRows.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">{totalUnmatched} unmatched rows detected during import</p>
              <p className="text-sm text-amber-700 mt-1">
                Row-level details were not saved. Re-import the statement to see each row.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}