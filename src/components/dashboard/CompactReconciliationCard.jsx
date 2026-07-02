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

    const filterByDate = (items, dateField) =>
      (items || []).filter((item) => {
        const d = new Date(item[dateField]);
        return d >= periodStart && d <= periodEnd;
      });

    // Orders total (order_value + shipping)
    const periodOrders = filterByDate(etsyOrders, "sale_date");
    const ordersTotal = periodOrders.reduce(
      (sum, o) => sum + (o.order_value || 0) + (o.shipping_charged || 0),
      0
    );

    // Statement total (sales + refunds from active imports)
    const statementLines = (etsyStatementLines || []).filter((l) => {
      const d = new Date(l.transaction_date);
      if (d < periodStart || d > periodEnd) return false;
      if (!l.import_id) return false;
      const imp = (etsyStatementImports || []).find((i) => i.id === l.import_id);
      return imp && imp.status !== "replaced";
    });

    const statementTotal = statementLines.reduce((sum, l) => {
      if (l.category === "sale" || l.category === "refund") return sum + (l.amount || 0);
      return sum;
    }, 0);

    const statementDelta = Math.abs(ordersTotal - statementTotal);

    // Cashflow: expected payout vs actual deposits
    const refunds = periodOrders.reduce((sum, o) => sum + (o.refund_amount || 0), 0);
    const fees = (orderFees || []).reduce((sum, f) => {
      const feeAmount = (f.total_fees || 0) - (f.share_save_credit || 0);
      return sum + Math.max(0, feeAmount);
    }, 0);
    const expectedPayout = ordersTotal - refunds - fees;

    const periodTransfers = filterByDate(transfers, "date");
    const actualDeposits = periodTransfers
      .filter((t) => t.type === "etsy_deposit")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const depositDelta = expectedPayout - actualDeposits;

    // Unmatched / excluded counts from financialData
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
      ordersTotal,
      statementTotal,
      statementDelta,
      expectedPayout,
      actualDeposits,
      depositDelta,
      unmatchedCount,
      excludedCount,
    };
  }, [etsyOrders, etsyStatementImports, etsyStatementLines, orderFees, transfers, financialData, periodStart, periodEnd]);

  if (!data) return null;

  // Build short status indicators
  const indicators = [];
  if (data.statementDelta >= 0.01) {
    indicators.push({
      icon: AlertCircle,
      text: `${fmt(data.statementDelta)} difference to review`,
      tone: "amber",
    });
  }
  if (data.depositDelta > 1) {
    indicators.push({
      icon: AlertCircle,
      text: `Deposits missing (${fmt(data.depositDelta)})`,
      tone: "red",
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
            { label: "Orders Total", value: data.ordersTotal },
            { label: "Statement Total", value: data.statementTotal },
            { label: "Difference", value: data.statementDelta, highlight: data.statementDelta >= 0.01 },
            { label: "Expected Payout", value: data.expectedPayout },
            { label: "Actual Deposits", value: data.actualDeposits, highlight: data.depositDelta > 1 },
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