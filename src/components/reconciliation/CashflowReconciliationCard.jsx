import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, TrendingDown } from "lucide-react";

export default function CashflowReconciliationCard({
  etsyOrders,
  etsyStatementImports,
  orderFees,
  transfers,
  periodStart,
  periodEnd,
}) {
  const cashflow = useMemo(() => {
    if (!periodStart || !periodEnd) return null;

    const filterByDate = (items, dateField) => {
      return (items || []).filter((item) => {
        const d = new Date(item[dateField]);
        return d >= periodStart && d <= periodEnd;
      });
    };

    // 1. Total order value (revenue before fees)
    const periodOrders = filterByDate(etsyOrders, "sale_date");
    const orderValue = periodOrders.reduce((sum, o) => sum + (o.order_value || 0) + (o.shipping_charged || 0), 0);

    // 2. Total refunds (reduce revenue)
    const refunds = periodOrders.reduce((sum, o) => sum + (o.refund_amount || 0), 0);

    // 3. Total fees (all fee types combined)
    const fees = (orderFees || []).reduce((sum, f) => {
      // Share & Save is a credit (reduces fees), so subtract it
      const feeAmount = (f.total_fees || 0) - (f.share_save_credit || 0);
      return sum + Math.max(0, feeAmount);
    }, 0);

    // Expected payout: orders - refunds - fees
    const expectedPayout = orderValue - refunds - fees;

    // 4. Actual deposits
    const periodTransfers = filterByDate(transfers, "date");
    const actualDeposits = periodTransfers
      .filter((t) => t.type === "etsy_deposit")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Delta: where's the money?
    const delta = expectedPayout - actualDeposits;
    const deltaPercent = expectedPayout > 0 ? (delta / expectedPayout) * 100 : 0;

    // Status logic
    let status = "matched";
    let severity = "success";
    if (Math.abs(delta) < 0.01) {
      status = "matched";
      severity = "success";
    } else if (Math.abs(deltaPercent) < 5) {
      status = "minor_variance";
      severity = "warning";
    } else if (Math.abs(deltaPercent) < 20) {
      status = "hold_or_pending";
      severity = "caution";
    } else {
      status = "significant_gap";
      severity = "error";
    }

    return {
      orderValue,
      refunds,
      fees,
      expectedPayout,
      actualDeposits,
      delta,
      deltaPercent,
      status,
      severity,
    };
  }, [etsyOrders, orderFees, transfers, etsyStatementImports, periodStart, periodEnd]);

  if (!cashflow) return null;

  const severityConfig = {
    success: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: CheckCircle2,
      color: "text-emerald-600",
      title: "Cashflow Matched",
      desc: "Deposits align with expected payout.",
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      icon: AlertCircle,
      color: "text-yellow-600",
      title: "Minor Variance",
      desc: "Small difference (< 5%). Likely processing delay.",
    },
    caution: {
      bg: "bg-orange-50",
      border: "border-orange-200",
      icon: TrendingDown,
      color: "text-orange-600",
      title: "Hold or Pending",
      desc: "Notable gap (5-20%). Check Etsy for holds or pending deposits.",
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: AlertCircle,
      color: "text-red-600",
      title: "Significant Gap",
      desc: "Large discrepancy (> 20%). Investigate immediately.",
    },
  };

  const config = severityConfig[cashflow.severity];
  const Icon = config.icon;

  return (
    <Card className={`${config.bg} ${config.border}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`w-5 h-5 ${config.color}`} />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-600 uppercase font-semibold">Expected Payout</p>
            <p className="text-lg font-bold">
              ${cashflow.expectedPayout.toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ${cashflow.orderValue.toFixed(0)} − ${cashflow.refunds.toFixed(0)} (refunds) − ${cashflow.fees.toFixed(0)} (fees)
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase font-semibold">Actual Deposits</p>
            <p className="text-lg font-bold">
              ${cashflow.actualDeposits.toFixed(0)}
            </p>
            <p className={`text-xs font-semibold mt-1 ${cashflow.delta > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {cashflow.delta > 0 ? "↑ Missing" : "↓ Ahead"} ${Math.abs(cashflow.delta).toFixed(0)}
            </p>
          </div>
        </div>
        <p className={`text-xs ${config.color} font-semibold`}>{config.desc}</p>
      </CardContent>
    </Card>
  );
}