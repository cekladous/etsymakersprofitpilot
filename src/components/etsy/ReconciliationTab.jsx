import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Download, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable from "@/components/ui/DataTable";
import DepositMatcher from "@/components/reconciliation/DepositMatcher";
import { format } from "date-fns";

export default function ReconciliationTab({ user }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const queryClient = useQueryClient();

  const { data: imports = [] } = useQuery({
    queryKey: ["etsy-statement-imports", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EtsyStatementImport.filter({ owner_user_id: user.id }, "-imported_at"),
  });

  const { data: unmatchedStatementLines = [] } = useQuery({
    queryKey: ["unmatched-statement-lines", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const all = await base44.entities.EtsyStatementLine.filter({ owner_user_id: user.id }, "-transaction_date", 1000);
      return all.filter(line => !line.matched);
    },
  });

  const { data: unmatchedLedgerEntries = [] } = useQuery({
    queryKey: ["unmatched-ledger-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const all = await base44.entities.EtsyLedgerEntry.filter({ owner_user_id: user.id }, "-entry_date", 5000);
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

  const totalUnmatched = unmatchedStatementLines.length + unmatchedLedgerEntries.length;

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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="deposits" className="w-full">
        <TabsList>
          <TabsTrigger value="deposits">Deposit Matching</TabsTrigger>
          <TabsTrigger value="statement">Statement Review</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="space-y-6">
          <DepositMatcher user={user} />
        </TabsContent>

        <TabsContent value="statement" className="space-y-6">
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
              <p className="text-sm text-stone-500">Import an Etsy statement CSV from the Orders tab</p>
            </div>
          ) : imports.filter(imp => imp.status !== 'replaced').length === 0 ? (
            <div className="text-center py-8">
              <p className="text-stone-600">No active imports</p>
            </div>
          ) : (
            <DataTable
              columns={importColumns}
              data={imports.filter(imp => imp.status !== 'replaced')}
              emptyMessage="No statement imports yet"
            />
          )}
        </CardContent>
      </Card>

      {totalUnmatched > 0 && (
        <>
          {Object.keys(unmatchedBreakdown).length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Unmatched Patterns (Debug)</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowBreakdown(!showBreakdown)}
                  >
                    {showBreakdown ? "Hide" : "Show"}
                  </Button>
                </CardTitle>
              </CardHeader>
              {showBreakdown && (
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(unmatchedBreakdown).map(([type, data]) => (
                      <div key={type} className="bg-white rounded-lg border border-blue-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-stone-900">{type}</p>
                          <Badge variant="outline">{data.count} rows</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-stone-600">
                          {data.examples.map((ex, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="truncate max-w-md">{ex.description}</span>
                              <span className="font-medium ml-2">${ex.amount?.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

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
        </>
        )}
        </TabsContent>
        </Tabs>
        </div>
        );
        }