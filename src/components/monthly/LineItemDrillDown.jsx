import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { AlertCircle, Info } from "lucide-react";

export default function LineItemDrillDown({ open, onOpenChange, title, items, expectedTotal }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const hasExpected = expectedTotal != null && Math.abs(expectedTotal) > 0.01;
  const hasMismatch = hasExpected && Math.abs(total - Math.abs(expectedTotal)) > 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-stone-400" />
            <p className="font-medium">No individual transactions found</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              {hasExpected
                ? `This line shows ${formatCurrency(Math.abs(expectedTotal))}, but no breakdown transactions are available in the underlying data for this period. This can happen when the amount is calculated from aggregated data (e.g., per-order fee splits) rather than individual statement lines.`
                : "This category has no transactions for the selected period."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">
                      {item.date ? format(new Date(item.date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.description || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{item.vendor || "—"}</TableCell>
                    <TableCell className="text-sm text-stone-500">{item.payment_source || "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center pt-4 border-t border-stone-200">
              <span className="font-semibold text-stone-900">
                {items.length} transaction{items.length !== 1 ? "s" : ""}
              </span>
              <div className="text-right">
                {hasMismatch && (
                  <p className="text-xs text-amber-600 mb-1">
                    Summary shows: {formatCurrency(Math.abs(expectedTotal))}
                  </p>
                )}
                <span className="font-bold text-lg text-stone-900">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {hasMismatch && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  The drill-down total differs from the summary because some amounts are adjusted
                  (e.g., sales tax excluded, credits netted, or per-order fee splits used).
                  The summary line item is authoritative.
                </span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}