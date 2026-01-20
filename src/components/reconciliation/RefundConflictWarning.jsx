import React, { useMemo } from "react";
import { AlertCircle } from "lucide-react";

export default function RefundConflictWarning({
  etsyOrders,
  etsyStatementLines,
  etsyStatementImports,
  orderIdBeingEdited,
}) {
  const conflict = useMemo(() => {
    if (!orderIdBeingEdited) return null;

    const order = etsyOrders?.find((o) => o.order_id === orderIdBeingEdited);
    if (!order || !order.refund_amount || order.refund_amount === 0) return null;

    // Check if this order's refund is ALSO in statement lines
    const statementLines = (etsyStatementLines || []).filter((line) => {
      if (!line.import_id) return false;
      const imp = (etsyStatementImports || []).find((i) => i.id === line.import_id);
      return imp && imp.status !== "replaced";
    });

    const matchingRefund = statementLines.find(
      (line) =>
        line.category === "refund" &&
        (line.order_id === orderIdBeingEdited || line.source_etsy_order_id === order.id)
    );

    if (matchingRefund) {
      return {
        orderId: orderIdBeingEdited,
        orderRefundAmount: order.refund_amount,
        statementRefundAmount: Math.abs(matchingRefund.amount),
        statementDate: matchingRefund.transaction_date,
      };
    }

    return null;
  }, [etsyOrders, etsyStatementLines, etsyStatementImports, orderIdBeingEdited]);

  if (!conflict) return null;

  return (
    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-300 rounded-lg mb-4">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-red-800">
        <p className="font-semibold">⚠️ Potential Duplicate Refund</p>
        <p className="mt-1">
          Order #{conflict.orderId} shows a ${conflict.orderRefundAmount.toFixed(2)} refund in your manual records
          <strong> AND</strong> a ${conflict.statementRefundAmount.toFixed(2)} refund in your imported statement
          (dated {conflict.statementDate}).
        </p>
        <p className="mt-2 text-xs">
          Only enter refunds manually if they are NOT in your monthly statement. If this is a duplicate, remove one entry.
        </p>
      </div>
    </div>
  );
}