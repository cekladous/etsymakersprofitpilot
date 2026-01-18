import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function ReconciliationWarning({ 
  dashboardTotal, 
  netProfitTotal, 
  actualsTotal,
  periodLabel 
}) {
  const hasDiscrepancy = useMemo(() => {
    // Allow for small rounding differences (< $0.01)
    const dashVsNetProfit = Math.abs(dashboardTotal - netProfitTotal) > 0.01;
    const dashVsActuals = Math.abs(dashboardTotal - actualsTotal) > 0.01;
    const netProfitVsActuals = Math.abs(netProfitTotal - actualsTotal) > 0.01;
    
    return dashVsNetProfit || dashVsActuals || netProfitVsActuals;
  }, [dashboardTotal, netProfitTotal, actualsTotal]);

  if (!hasDiscrepancy) return null;

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 mb-1">
              Reconciliation Warning
            </h3>
            <p className="text-sm text-amber-800 mb-3">
              Expense totals don't match across views for {periodLabel}. This indicates a calculation inconsistency.
            </p>
            <div className="text-xs space-y-1 text-amber-700 font-mono">
              <p>Dashboard Total Expenses: ${dashboardTotal.toFixed(2)}</p>
              <p>Net Profit Total Expenses: ${netProfitTotal.toFixed(2)}</p>
              <p>Actuals Matrix Total: ${actualsTotal.toFixed(2)}</p>
            </div>
            <p className="text-xs text-amber-600 mt-2 italic">
              All three should match exactly. If this persists, please contact support.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}