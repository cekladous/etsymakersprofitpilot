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

export default function LineItemDrillDown({ open, onOpenChange, title, items }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            <p>No transactions found for this period</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Payment Method</TableHead>
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
                      {item.description || item.material_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{item.vendor || "—"}</TableCell>
                    <TableCell className="text-sm">{item.payment_method || item.payment_source || "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center pt-4 border-t border-stone-200">
              <span className="font-semibold text-stone-900">Total</span>
              <span className="font-bold text-lg text-stone-900">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}