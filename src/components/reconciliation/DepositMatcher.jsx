import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Link as LinkIcon, Unlink, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO, isWithinInterval, addDays, subDays } from "date-fns";

export default function DepositMatcher({ user }) {
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [showAllMatched, setShowAllMatched] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Etsy deposits (Transfer records imported from Etsy Payment Account CSV)
  const { data: etsyDeposits = [] } = useQuery({
    queryKey: ["etsy-deposits", user?.id],
    enabled: !!user,
    queryFn: () =>
      base44.entities.Transfer.filter({
        owner_user_id: user.id,
        type: "etsy_deposit"
      }, "-date")
  });

  // Fetch all transfers (bank transfers — optional, if user imports bank statements)
  const { data: bankTransfers = [] } = useQuery({
    queryKey: ["bank-transfers", user?.id],
    enabled: !!user,
    queryFn: () =>
      base44.entities.Transfer.filter({
        owner_user_id: user.id,
        type: "owner_transfer"
      }, "-date")
  });

  // Fetch Etsy statement imports — each deposit was imported as part of a
  // statement, so we auto-match by checking if the deposit date falls within
  // the import's date range.
  const { data: statementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports", user?.id],
    enabled: !!user,
    queryFn: () =>
      base44.entities.EtsyStatementImport.filter({
        owner_user_id: user.id
      }, "-imported_at")
  });

  // Fetch existing manual links (deposits linked to bank transfers)
  const { data: existingLinks = [] } = useQuery({
    queryKey: ["transaction-links", user?.id],
    enabled: !!user,
    queryFn: () =>
      base44.entities.TransactionLink.filter({
        owner_user_id: user.id
      })
  });

  // Auto-match deposits to their parent statement import by date range.
  // A deposit is "matched" if it falls within an active (non-replaced) import's
  // date_range_start..date_range_end.
  const activeImports = (statementImports || []).filter(imp => imp.status !== 'replaced');
  const statementMatches = useMemo(() => {
    const matches = new Map(); // deposit.id -> import record
    etsyDeposits.forEach(deposit => {
      const match = activeImports.find(imp => {
        if (!imp.date_range_start || !imp.date_range_end) return false;
        try {
          return isWithinInterval(parseISO(deposit.date), {
            start: parseISO(imp.date_range_start),
            end: parseISO(imp.date_range_end)
          });
        } catch { return false; }
      });
      if (match) matches.set(deposit.id, match);
    });
    return matches;
  }, [etsyDeposits, statementImports]);

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: async ({ depositId, transferId, deposit, transfer }) => {
      const discrepancy = transfer.amount - deposit.amount;
      await base44.entities.TransactionLink.create({
        owner_user_id: user.id,
        etsy_deposit_id: depositId,
        bank_transfer_id: transferId,
        etsy_amount: deposit.amount,
        bank_amount: transfer.amount,
        discrepancy,
        link_date: new Date().toISOString().split('T')[0],
        status: Math.abs(discrepancy) < 0.01 ? "confirmed" : "pending"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-links"] });
      setSelectedDeposit(null);
      setSelectedTransfer(null);
    }
  });

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: (linkId) => base44.entities.TransactionLink.delete(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-links"] });
    }
  });

  // Find unlinked items — a deposit is "matched" if it has a manual bank link
  // OR an auto-match to a statement line deposit.
  const linkedDepositIds = new Set(existingLinks.map(l => l.etsy_deposit_id));
  const linkedTransferIds = new Set(existingLinks.map(l => l.bank_transfer_id));
  const unlinkedDeposits = etsyDeposits.filter(d => !linkedDepositIds.has(d.id) && !statementMatches.has(d.id));
  const unlinkedTransfers = bankTransfers.filter(t => !linkedTransferIds.has(t.id));

  // Auto-suggest matches
  const suggestions = useMemo(() => {
    return unlinkedDeposits
      .flatMap(deposit => {
        const potentialMatches = unlinkedTransfers.filter(transfer => {
          const dateMatch = isWithinInterval(
            parseISO(transfer.date),
            { start: subDays(parseISO(deposit.date), 7), end: addDays(parseISO(deposit.date), 7) }
          );
          const amountClose = Math.abs(transfer.amount - deposit.amount) < 1; // Within $1
          return dateMatch && amountClose;
        });
        return potentialMatches.map(transfer => ({
          deposit,
          transfer,
          confidence: Math.abs(transfer.amount - deposit.amount) === 0 ? "high" : "medium",
          discrepancy: transfer.amount - deposit.amount
        }));
      })
      .sort((a, b) => a.discrepancy - b.discrepancy);
  }, [unlinkedDeposits, unlinkedTransfers]);

  // Calculate summary — matched includes both manual bank links and auto-matched
  // statement line deposits.
  const statementMatchedAmount = etsyDeposits
    .filter(d => statementMatches.has(d.id))
    .reduce((sum, d) => sum + d.amount, 0);
  const bankMatchedAmount = existingLinks.reduce((sum, link) => sum + link.etsy_amount, 0);
  const summary = {
    totalDeposits: etsyDeposits.reduce((sum, d) => sum + d.amount, 0),
    totalTransfers: bankTransfers.reduce((sum, t) => sum + t.amount, 0),
    matched: bankMatchedAmount + statementMatchedAmount,
    unmatched: unlinkedDeposits.reduce((sum, d) => sum + d.amount, 0),
    discrepancies: existingLinks.reduce((sum, link) => sum + Math.abs(link.discrepancy), 0)
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500">Total Deposits</p>
            <p className="text-xl font-bold text-stone-900">${summary.totalDeposits.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500">Matched</p>
            <p className="text-xl font-bold text-emerald-600">${summary.matched.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500">Unmatched</p>
            <p className="text-xl font-bold text-amber-600">${summary.unmatched.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500">Total Transfers</p>
            <p className="text-xl font-bold text-stone-900">${summary.totalTransfers.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500">Discrepancies</p>
            <p className={`text-xl font-bold ${summary.discrepancies > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              ${summary.discrepancies.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-emerald-600" />
              {suggestions.length} Matching Suggestion{suggestions.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-emerald-200 p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-stone-900">
                      {format(parseISO(suggestion.deposit.date), "MMM d")} Deposit
                    </p>
                    <Badge variant="outline" className={
                      suggestion.confidence === "high" 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-amber-100 text-amber-800"
                    }>
                      {suggestion.confidence}
                    </Badge>
                  </div>
                  <p className="text-sm text-stone-600">
                    Deposit: ${suggestion.deposit.amount.toFixed(2)} → 
                    Transfer: ${suggestion.transfer.amount.toFixed(2)}
                    {suggestion.discrepancy !== 0 && (
                      <span className="ml-2 text-rose-600">
                        (Diff: ${suggestion.discrepancy.toFixed(2)})
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  onClick={() => createLinkMutation.mutate({
                    depositId: suggestion.deposit.id,
                    transferId: suggestion.transfer.id,
                    deposit: suggestion.deposit,
                    transfer: suggestion.transfer
                  })}
                  disabled={createLinkMutation.isPending}
                  className="ml-4"
                  size="sm"
                >
                  Link
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Auto-matched statement deposits — collapsed by default */}
      {statementMatches.size > 0 && (
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Auto-Matched to Statement ({statementMatches.size})
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowAllMatched(!showAllMatched)}>
                {showAllMatched ? "Collapse" : "Show all"}
                {showAllMatched
                  ? <ChevronDown className="w-4 h-4 ml-1" />
                  : <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {showAllMatched && (
            <CardContent>
              <div className="space-y-2">
                {etsyDeposits.filter(d => statementMatches.has(d.id)).map((deposit) => {
                  const imp = statementMatches.get(deposit.id);
                  return (
                    <div key={deposit.id} className="bg-stone-50 rounded-lg border p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-stone-900 text-sm">
                          {format(parseISO(deposit.date), "MMM d, yyyy")}
                        </p>
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">matched</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-stone-600">${deposit.amount.toFixed(2)}</span>
                        <span className="text-xs text-stone-400">→ {imp.statement_month}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Existing Links */}
      {existingLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Linked Transactions ({existingLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {existingLinks.map((link) => (
                <div key={link.id} className="bg-stone-50 rounded-lg border p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-stone-900">
                        {format(parseISO(link.link_date), "MMM d, yyyy")}
                      </p>
                      <Badge className={
                        link.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800"
                          : link.status === "disputed"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }>
                        {link.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-stone-600">
                      ${link.etsy_amount.toFixed(2)} → ${link.bank_amount.toFixed(2)}
                      {Math.abs(link.discrepancy) > 0.01 && (
                        <span className="ml-2 text-rose-600">
                          Discrepancy: ${Math.abs(link.discrepancy).toFixed(2)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Unlink this transaction?")) {
                        deleteLinkMutation.mutate(link.id);
                      }
                    }}
                    disabled={deleteLinkMutation.isPending}
                  >
                    <Unlink className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Linking */}
      {unlinkedDeposits.length > 0 && unlinkedTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Linking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Unlinked Deposits */}
              <div>
                <p className="font-semibold text-stone-900 mb-3">Etsy Deposits ({unlinkedDeposits.length})</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unlinkedDeposits.map((deposit) => (
                    <button
                      key={deposit.id}
                      onClick={() => setSelectedDeposit(selectedDeposit?.id === deposit.id ? null : deposit)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedDeposit?.id === deposit.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-stone-200 hover:border-emerald-300"
                      }`}
                    >
                      <p className="font-medium text-sm">{format(parseISO(deposit.date), "MMM d")}</p>
                      <p className="text-lg font-bold text-emerald-600">${deposit.amount.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Unlinked Transfers */}
              <div>
                <p className="font-semibold text-stone-900 mb-3">Bank Transfers ({unlinkedTransfers.length})</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unlinkedTransfers.map((transfer) => (
                    <button
                      key={transfer.id}
                      onClick={() => setSelectedTransfer(selectedTransfer?.id === transfer.id ? null : transfer)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedTransfer?.id === transfer.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-stone-200 hover:border-blue-300"
                      }`}
                    >
                      <p className="font-medium text-sm">{format(parseISO(transfer.date), "MMM d")}</p>
                      <p className="text-lg font-bold text-blue-600">${transfer.amount.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedDeposit && selectedTransfer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-stone-900">Link Preview</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-stone-600">Deposit</p>
                    <p className="text-lg font-bold text-emerald-600">${selectedDeposit.amount.toFixed(2)}</p>
                  </div>
                  <div className="text-2xl text-stone-400">→</div>
                  <div>
                    <p className="text-sm text-stone-600">Transfer</p>
                    <p className="text-lg font-bold text-blue-600">${selectedTransfer.amount.toFixed(2)}</p>
                  </div>
                </div>
                {Math.abs(selectedTransfer.amount - selectedDeposit.amount) > 0.01 && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3">
                    <p className="text-sm text-amber-800">
                      ⚠ Discrepancy: ${Math.abs(selectedTransfer.amount - selectedDeposit.amount).toFixed(2)}
                    </p>
                  </div>
                )}
                <Button
                  onClick={() => createLinkMutation.mutate({
                    depositId: selectedDeposit.id,
                    transferId: selectedTransfer.id,
                    deposit: selectedDeposit,
                    transfer: selectedTransfer
                  })}
                  disabled={createLinkMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Confirm Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {unlinkedDeposits.length === 0 && etsyDeposits.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
            <p className="font-semibold text-emerald-900">All deposits matched!</p>
            <p className="text-sm text-emerald-700">Every Etsy deposit is linked to a bank transfer.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}