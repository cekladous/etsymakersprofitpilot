import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, ShoppingBag } from "lucide-react";

export default function ConvertQuoteDialog({
  open,
  onOpenChange,
  quote,
  onConfirm,
  isPending,
}) {
  const [selectedChannel, setSelectedChannel] = useState("custom");

  if (!quote) return null;

  const grandTotal =
    (quote.materials?.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0) || 0) +
    (quote.design_hours || 0 + quote.design_minutes || 0 / 60) * (quote.design_rate || 0) +
    (quote.manual_labor_hours || 0 + quote.manual_labor_minutes || 0 / 60) * (quote.manual_labor_rate || 0) +
    (quote.machines?.reduce((sum, m) => sum + ((parseFloat(m.hours) || 0) + (parseFloat(m.minutes) || 0) / 60) * (parseFloat(m.rate) || 0), 0) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Convert Quote to Order?
          </DialogTitle>
          <DialogDescription>
            This will create an order entry from this quote and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-stone-50">
            <CardContent className="pt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-600">Quote #:</span>
                <span className="font-semibold">{quote.quote_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Project:</span>
                <span className="font-semibold">{quote.project_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Customer:</span>
                <span className="font-semibold">{quote.customer_name}</span>
              </div>
              <div className="border-t border-stone-200 pt-2 flex justify-between font-semibold text-base">
                <span>Total Amount:</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-stone-700">Where should this order be recorded?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedChannel("etsy")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedChannel === "etsy"
                    ? "border-blue-600 bg-blue-50"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <ShoppingBag className={`w-5 h-5 mx-auto mb-2 ${selectedChannel === "etsy" ? "text-blue-600" : "text-stone-400"}`} />
                <div className="text-sm font-semibold text-stone-900">Etsy Sales</div>
                <div className="text-xs text-stone-500 mt-1">Etsy marketplace order</div>
              </button>
              <button
                onClick={() => setSelectedChannel("custom")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedChannel === "custom"
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <ShoppingBag className={`w-5 h-5 mx-auto mb-2 ${selectedChannel === "custom" ? "text-emerald-600" : "text-stone-400"}`} />
                <div className="text-sm font-semibold text-stone-900">Custom Sales</div>
                <div className="text-xs text-stone-500 mt-1">Non-Etsy order</div>
              </button>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 space-y-2">
            <div className="flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Order details will be pre-filled with:</p>
                <ul className="text-xs list-disc list-inside space-y-0.5">
                  <li>Customer information</li>
                  <li>Project name and materials cost</li>
                  <li>Quote total as order amount</li>
                  <li>Quote reference in order notes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm(selectedChannel)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? "Converting..." : "Convert to Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}