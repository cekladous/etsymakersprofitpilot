import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function ReconciliationCheckCard({ etsyOrders, etsyStatementImports, etsyStatementLines, periodStart, periodEnd }) {
  const reconciliation = useMemo(() => {
    if (!periodStart || !periodEnd) return null;

    // Sum all orders in period
    const ordersTotal = etsyOrders
      .filter(o => {
        const d = new Date(o.sale_date);
        return d >= periodStart && d <= periodEnd;
      })
      .reduce((sum, o) => sum + (o.order_value || 0) + (o.shipping_charged || 0), 0);

    // Sum all active statement lines in period (exclude replaced imports)
    const statementLines = (etsyStatementLines || []).filter(l => {
      const d = new Date(l.transaction_date);
      if (d < periodStart || d > periodEnd) return false;
      if (!l.import_id) return false;
      const imp = (etsyStatementImports || []).find(i => i.id === l.import_id);
      return imp && imp.status !== "replaced";
    });

    const statementTotal = statementLines.reduce((sum, l) => {
      if (l.category === "sale" || l.category === "refund") {
        return sum + (l.amount || 0);
      }
      return sum;
    }, 0);

    const delta = Math.abs(ordersTotal - statementTotal);
    const deltaPercent = ordersTotal > 0 ? (delta / ordersTotal) * 100 : 0;
    const isMatched = delta < 0.01 || deltaPercent < 0.5;

    return {
      ordersTotal,
      statementTotal,
      delta,
      deltaPercent,
      isMatched,
      statementLineCount: statementLines.length
    };
  }, [etsyOrders, etsyStatementImports, etsyStatementLines, periodStart, periodEnd]);

  if (!reconciliation) return null;

  return (
    <Card className={reconciliation.isMatched ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {reconciliation.isMatched ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600" />
          )}
          Reconciliation Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-600 uppercase font-semibold">Orders Total</p>
            <p className="text-lg font-bold">${reconciliation.ordersTotal.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase font-semibold">Statement Total</p>
            <p className="text-lg font-bold">${reconciliation.statementTotal.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase font-semibold">Difference</p>
            <p className={`text-lg font-bold ${reconciliation.isMatched ? "text-emerald-600" : "text-amber-600"}`}>
              ${reconciliation.delta.toFixed(0)}
            </p>
          </div>
        </div>
        <p className={`text-xs ${reconciliation.isMatched ? "text-emerald-700" : "text-amber-700"}`}>
          {reconciliation.isMatched
            ? `✓ Your orders match your statement (${reconciliation.statementLineCount} lines imported)`
            : `⚠ Difference of ${reconciliation.deltaPercent.toFixed(1)}%. Check for missing refunds or incomplete imports.`}
        </p>
      </CardContent>
    </Card>
  );
}