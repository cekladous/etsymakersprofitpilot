import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

const fmt = (v) => `$${(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function CompactReconciliationCard({
  etsyOrders,
  etsyStatementImports,
  etsyStatementLines,
  orderFees,
  transfers,
  financialData,
  periodStart,
  periodEnd,
}) {
  const data = useMemo(() => {
    if (!periodStart || !periodEnd) return null;

    // Pull from financialData (shared aggregator — single source of truth)
    const rev = financialData?.revenue || {};
    const sell = financialData?.sellingExpenses || {};
    const cash = financialData?.cashflow || {};

    const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

    // Net Sales (order_total - refunds - tax - CO fee) — matches Etsy statement
    const netSales = toNum(rev.netEtsySales);

    // Fees + Marketing + Shipping (all platform-controlled deductions)
    const feesTotal = toNum(sell.totalEtsyFees);
    const marketingTotal = toNum(sell.totalMarketing);
    const shippingTotal = toNum(sell.etsyShipping) + toNum(sell.otherPostage);

    // Imported Statement Net = Net Sales - Fees - Marketing - Shipping (matches Etsy official statement)
    const statementNet = netSales - feesTotal - marketingTotal - shippingTotal;

    // Actual deposits from Transfer records
    const actualDeposits = toNum(cash.etsyDeposits);

    // Difference between what Etsy should deposit and what actually hit the bank
    const depositDelta = statementNet - actualDeposits;

    const unmatchedCount =
      (financialData?.unmatchedLedgerEntriesCount || 0) +
      (financialData?.unmatchedStatementLinesCount || 0);

    // Excluded records: replaced imports' lines
    const excludedCount = (etsyStatementLines || []).filter((l) => {
      if (!l.import_id) return false;
      const imp = (etsyStatementImports || []).find((i) => i.id === l.import_id);
      return imp && imp.status === "replaced";
    }).length;

    return {
      netSales,
      feesTotal,
      marketingTotal,
      statementNet,
      actualDeposits,
      depositDelta,
      unmatchedCount,
      excludedCount,
    };
  }, [etsyStatementLines, etsyStatementImports, financialData, periodStart, periodEnd]);

  if (!data) return null;

  // Build short status indicators
  // Small differences between statement net and actual deposits are normal due to
  // payout timing (deposits may arrive a day or two after the statement period closes).
  // Only flag as a warning when the difference is unusually large (> $50).
  const indicators = [];
  const absDepositDelta = Math.abs(data.depositDelta);
  const LARGE_THRESHOLD = 50;
  if (absDepositDelta >= 0.01 && absDepositDelta < LARGE_THRESHOLD) {
    indicators.push({
      icon: AlertCircle,
      text: `${fmt(absDepositDelta)} ${data.depositDelta > 0 ? 'pending deposit' : 'minor overage'} — normal payout timing`,
      tone: "stone",
    });
  } else if (absDepositDelta >= LARGE_THRESHOLD) {
    indicators.push({
      icon: AlertCircle,
      text: data.depositDelta > 0
        ? `${fmt(absDepositDelta)} deposits missing — review needed`
        : `${fmt(absDepositDelta)} over deposited — review needed`,
      tone: "amber",
    });
  }
  if (data.excludedCount > 0) {
    indicators.push({
      icon: AlertCircle,
      text: `${data.excludedCount} records excluded from reconciliation`,
      tone: "stone",
    });
  }
  if (data.unmatchedCount > 0) {
    indicators.push({
      icon: AlertCircle,
      text: `${data.unmatchedCount} transactions need categorization`,
      tone: "amber",
    });
  }

  const allGood = indicators.length === 0;
  const toneMap = {
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
    stone: "text-stone-600 bg-stone-100",
    emerald: "text-emerald-700 bg-emerald-50",
  };

  return (
    <Card className={`border ${allGood ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"}`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {allGood ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            <h3 className="text-base font-semibold text-stone-900">Reconciliation</h3>
          </div>
          <Link to={createPageUrl("Orders") + "?tab=reconciliation"}>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              Review & Reconcile
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Key Numbers */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            { label: "Net Sales", value: data.netSales },
            { label: "Fees + Marketing", value: data.feesTotal + data.marketingTotal },
            { label: "Statement Net", value: data.statementNet },
            { label: "Actual Deposits", value: data.actualDeposits, highlight: Math.abs(data.depositDelta) > 1 },
            { label: "Difference", value: data.depositDelta, highlight: Math.abs(data.depositDelta) >= 0.01 },
          ].map((item) => (
            <div key={item.label} className="text-center md:text-left">
              <p className="text-xs text-stone-500 uppercase font-medium">{item.label}</p>
              <p className={`text-lg font-bold ${item.highlight ? "text-amber-600" : "text-stone-900"}`}>
                {fmt(item.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Status Indicators */}
        {allGood ? (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${toneMap.emerald}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            All reconciled — no action needed
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {indicators.map((ind, i) => {
              const IndIcon = ind.icon;
              return (
                <div
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${toneMap[ind.tone]}`}
                >
                  <IndIcon className="w-3.5 h-3.5" />
                  {ind.text}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}