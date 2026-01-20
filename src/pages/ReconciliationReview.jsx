import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileText, Download, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import UnmatchedLineCard from "@/components/reconciliation/UnmatchedLineCard";
import { format } from "date-fns";

export default function ReconciliationReview() {
  const { user, loading } = useAuth();
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const queryClient = useQueryClient();
  const { data: imports = [] } = useQuery({
    queryKey: ["etsy-statement-imports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementImport.filter({ owner_user_id: user.id }, "-imported_at"),
  });

  const { data: allStatementLines = [] } = useQuery({
    queryKey: ["statement-lines", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return await base44.entities.EtsyStatementLine.filter({ owner_user_id: user.id }, "-transaction_date", 1000);
    },
  });

  const unmatchedStatementLines = useMemo(() => 
    allStatementLines.filter(line => line.resolution_status === 'unresolved'),
    [allStatementLines]
  );

  const { data: unmatchedLedgerEntries = [] } = useQuery({
    queryKey: ["unmatched-ledger-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const all = await base44.entities.EtsyLedgerEntry.filter({ owner_user_id: user.id }, "-entry_date", 5000);
      return all.filter(e => e.status === "Unmatched" || !e.matched_category);
    },
  });

  const resolveLineMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('resolveStatementLine', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statement-lines"] });
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
      queryClient.invalidateQueries({ queryKey: ["statement-lines"] });
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

  const reconciliationStats = useMemo(() => {
    const unresolvedAmount = unmatchedStatementLines.reduce((sum, line) => sum + line.amount, 0);
    const totalUnresolved = unmatchedStatementLines.length;
    const totalLegacy = unmatchedLedgerEntries.length;
    
    return {
      totalUnresolved,
      totalLegacy,
      unresolvedAmount,
      status: totalUnresolved === 0 ? 'PASS' : 'FAIL'
    };
  }, [unmatchedStatementLines, unmatchedLedgerEntries]);

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

  // Create breakdown by Type for debugging
  const unmatchedBreakdown = React.useMemo(() => {
    const breakdown = {};
    allUnmatchedRows.forEach(row => {
      const key = row.type || 'Unknown Type';
      if (!breakdown[key]) {
        breakdown[key] = { count: 0, examples: [] };
      }
      breakdown[key].count++;
      if (breakdown[key].examples.length < 3) {
        breakdown[key].examples.push({
          description: row.description,
          amount: row.amount,
          date: row.transaction_date
        });
      }
    });
    return breakdown;
  }, [allUnmatchedRows]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import History & Unmatched Items"
        description="View your statement imports and resolve any unmatched lines"
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
          {imports.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-stone-600 mb-2">No imports yet</p>
              <p className="text-sm text-stone-500">Import an Etsy statement CSV from the Etsy Activity page</p>
            </div>
          ) : imports.filter(imp => imp.status !== 'replaced').length === 0 ? (
            <div className="text-center py-8">
              <p className="text-stone-600">No active imports</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-900">
                  ℹ️ Each import populates Orders, Fees, Deposits across the app. Check the Orders and Etsy Activity pages to see your data.
                </p>
              </div>
              <DataTable
                columns={importColumns}
                data={imports.filter(imp => imp.status !== 'replaced')}
                emptyMessage="No statement imports yet"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation Status Card */}
      {imports.length > 0 && (
        <Card className={reconciliationStats.status === 'PASS' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {reconciliationStats.status === 'PASS' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`font-bold text-lg ${reconciliationStats.status === 'PASS' ? 'text-emerald-900' : 'text-rose-900'}`}>
                    Reconciliation: {reconciliationStats.status}
                  </p>
                  {reconciliationStats.status === 'FAIL' && (
                    <div className="text-sm mt-1 space-y-1">
                      <p className={reconciliationStats.status === 'FAIL' ? 'text-rose-700' : 'text-emerald-700'}>
                        {reconciliationStats.totalUnresolved} rows unresolved
                      </p>
                      <p className={`font-mono font-bold ${reconciliationStats.unresolvedAmount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        Δ ${Math.abs(reconciliationStats.unresolvedAmount).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reconciliationStats.totalUnresolved > 0 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>🔍 How to resolve:</strong> Each card below shows why a line couldn't be auto-matched. Review the recommendation and choose an action.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {unmatchedStatementLines.map((line) => (
              <UnmatchedLineCard
                key={line.id}
                line={line}
                onResolve={(payload) => resolveLineMutation.mutate(payload)}
                isLoading={resolveLineMutation.isPending}
              />
            ))}
          </div>

          {unmatchedLedgerEntries.length > 0 && (
            <Card className="border-stone-300">
              <CardHeader>
                <CardTitle className="text-base">Legacy Unmatched Entries ({unmatchedLedgerEntries.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-stone-600 mb-4">
                  These are from older imports. They don't affect current reconciliation but may need cleanup.
                </p>
                <DataTable
                  columns={columns}
                  data={allUnmatchedRows.filter(r => r.source === 'Legacy Data')}
                  emptyMessage="No legacy entries"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}