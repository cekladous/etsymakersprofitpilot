import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";

const parseMoney = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const str = String(v ?? "").trim().replace(/[$,]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const normalizeRow = (row) => {
  const normalized = {};
  Object.keys(row).forEach(key => {
    const trimmedKey = key.trim();
    normalized[trimmedKey] = row[key];
  });
  return normalized;
};

const getRowValue = (row, ...keyOptions) => {
  for (const key of keyOptions) {
    const val = row[key];
    if (val !== null && val !== undefined && val !== "") {
      return val;
    }
  }
  return "";
};

export default function EtsyPaymentAccountImport({ open, onOpenChange, embedded = false }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ fileName, parsedData }) => {
      const { rows } = parsedData;
      const currentUser = await base44.auth.me();

      // Pre-fetch existing orders and order fees in parallel
      const [allExistingOrders, allExistingOrderFees] = await Promise.all([
        base44.entities.EtsyOrder.filter({ owner_user_id: currentUser.id }),
        base44.entities.OrderFee.filter({ owner_user_id: currentUser.id }),
      ]);

      const orderMap = {};
      allExistingOrders.forEach(o => { orderMap[String(o.order_id).trim()] = o; });

      const orderFeeMap = {};
      allExistingOrderFees.forEach(of => { orderFeeMap[of.order_id] = of; });

      const result = {
        matched: 0,
        unmatched: 0,
        refundsUpdated: 0,
        channelSet: 0,
        feesCreated: 0,
        feesSkipped: 0,
        errors: [],
      };

      const ordersToUpdate = [];
      const orderFeesToCreate = [];

      for (const row of rows) {
        const orderId = String(getRowValue(row, "OrderID", "Order ID", "Order Id") || "").trim();
        if (!orderId) {
          result.unmatched++;
          continue;
        }

        const existingOrder = orderMap[orderId];
        if (!existingOrder) {
          result.unmatched++;
          continue;
        }

        result.matched++;

        const updateData = { id: existingOrder.id };
        let hasChanges = false;

        // 1. Set refund_amount from RefundAmount column (authoritative per-order source)
        const refundAmount = parseMoney(getRowValue(row, "RefundAmount", "Refund Amount"));
        if (Math.abs(refundAmount - (existingOrder.refund_amount || 0)) > 0.005) {
          updateData.refund_amount = refundAmount;
          result.refundsUpdated++;
          hasChanges = true;

          // Set status based on refund amount vs order total
          const ordTotal = existingOrder.order_total || 0;
          if (refundAmount > 0) {
            updateData.status = (ordTotal > 0 && refundAmount >= ordTotal - 0.01) ? "Canceled" : "Refunded";
          }
        }

        // 2. Only set channel info if order doesn't already have it
        // Sold Orders Report values (e.g. "inperson_square_card") are more specific
        // and should not be overwritten by generic "online" from this CSV
        const csvOrderType = String(getRowValue(row, "OrderType", "Order Type") || "").trim();
        const csvPaymentType = String(getRowValue(row, "PaymentType", "Payment Type") || "").trim();

        if (csvOrderType && !existingOrder.order_type) {
          updateData.order_type = csvOrderType;
          result.channelSet++;
          hasChanges = true;
        }
        if (csvPaymentType && !existingOrder.payment_type) {
          updateData.payment_type = csvPaymentType;
          result.channelSet++;
          hasChanges = true;
        }

        if (hasChanges) {
          ordersToUpdate.push(updateData);
        }

        // 3. Create OrderFee with lump Fees as processing_fees when no granular breakdown exists
        const lumpFees = Math.abs(parseMoney(getRowValue(row, "Fees")));
        const existingOrderFee = orderFeeMap[orderId];

        if (lumpFees > 0 && !existingOrderFee) {
          orderFeesToCreate.push({
            owner_user_id: currentUser.id,
            order_id: orderId,
            processing_fees: lumpFees,
            other_fees: 0,
            total_fees: lumpFees,
          });
          result.feesCreated++;
        } else if (lumpFees > 0 && existingOrderFee) {
          result.feesSkipped++;
        }
      }

      // Bulk update orders (chunked, same pattern as other imports)
      for (let i = 0; i < ordersToUpdate.length; i += 10) {
        const chunk = ordersToUpdate.slice(i, i + 10);
        try {
          await base44.entities.EtsyOrder.bulkUpdate(chunk);
        } catch (error) {
          for (const item of chunk) {
            const { id, ...updateData } = item;
            try {
              await base44.entities.EtsyOrder.update(id, updateData);
            } catch (itemError) {
              result.errors.push(`Order ${id}: ${itemError.message}`);
            }
          }
        }
        if (i + 10 < ordersToUpdate.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      // Bulk create OrderFee records (chunked)
      for (let i = 0; i < orderFeesToCreate.length; i += 25) {
        const chunk = orderFeesToCreate.slice(i, i + 25);
        try {
          await base44.entities.OrderFee.bulkCreate(chunk);
        } catch (error) {
          for (const item of chunk) {
            try {
              await base44.entities.OrderFee.create(item);
            } catch (itemError) {
              result.errors.push(`OrderFee ${item.order_id}: ${itemError.message}`);
            }
          }
        }
        if (i + 25 < orderFeesToCreate.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      setImporting(false);
      setPreview(null);
      setPendingData(null);
    },
    onError: (error) => {
      setImportResult({ error: error.message });
      setImporting(false);
    },
  });

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setImportResult({ error: 'Invalid file type. Please upload a CSV or Excel file.' });
      return;
    }

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const xlsxModule = await import("xlsx");
        const XLSX = xlsxModule.default || xlsxModule;
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

        if (jsonData.length === 0) {
          setImportResult({ error: "File is empty or contains no data rows." });
          setImporting(false);
          return;
        }

        // Validate required columns
        const firstRow = normalizeRow(jsonData[0]);
        if (!firstRow.hasOwnProperty("OrderID") && !firstRow.hasOwnProperty("Order ID")) {
          setImportResult({ error: "Missing 'OrderID' column. Please ensure you're uploading the Etsy Payment Account CSV." });
          setImporting(false);
          return;
        }

        const rows = jsonData.map(normalizeRow).filter(row => {
          const orderId = getRowValue(row, "OrderID", "Order ID", "Order Id");
          return !!orderId;
        });

        if (rows.length === 0) {
          setImportResult({ error: "No rows with Order IDs found. The Payment Account CSV requires an OrderID column." });
          setImporting(false);
          return;
        }

        setPreview({ count: rows.length });
        setPendingData({ fileName: file.name, parsedData: { rows } });
        setImporting(false);
      } catch (error) {
        setImportResult({ error: `Failed to process file: ${error.message}` });
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const confirmImport = () => {
    if (pendingData) {
      setImporting(true);
      setPreview(null);
      importMutation.mutate(pendingData);
    }
  };

  const handleClose = () => {
    setImportResult(null);
    setPreview(null);
    setPendingData(null);
    if (!embedded) onOpenChange(false);
  };

  if (embedded) {
    return (
      <div className="space-y-4 py-4">
        <DialogHeader>
          <DialogTitle>Import Etsy Payment Account CSV</DialogTitle>
          <DialogDescription>
            Upload your Etsy Payment Account CSV to update per-order refund amounts, set channel info, and populate lump-sum fees for orders without a Monthly Statement fee breakdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />

          {!importing && !preview && !importResult && (
            <Button onClick={() => fileInputRef.current?.click()} className="w-full" variant="outline" size="lg">
              <Upload className="w-5 h-5 mr-2" />
              Select Payment Account CSV
            </Button>
          )}

          {importing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Processing payment account data...</p>
            </div>
          )}

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Import Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-stone-900">Rows with Order IDs</p>
                  <p className="text-2xl font-semibold text-emerald-600">{preview.count}</p>
                  <p className="text-xs text-stone-500 mt-1">Rows will be matched to existing orders by Order ID</p>
                </div>
              </CardContent>
            </Card>
          )}

          {importResult && !importResult.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="font-semibold text-emerald-900">Import Successful</p>
              </div>
              <div className="text-sm text-emerald-800 space-y-1">
                <p>✓ {importResult.matched} orders matched</p>
                {importResult.unmatched > 0 && (
                  <p className="text-stone-600">— {importResult.unmatched} rows had no matching order (skipped)</p>
                )}
                {importResult.refundsUpdated > 0 && (
                  <p>✓ {importResult.refundsUpdated} refund amounts updated</p>
                )}
                {importResult.channelSet > 0 && (
                  <p>✓ {importResult.channelSet} channel fields populated</p>
                )}
                {importResult.feesCreated > 0 && (
                  <p>✓ {importResult.feesCreated} fee records created (lump-sum processing fees)</p>
                )}
                {importResult.feesSkipped > 0 && (
                  <p className="text-stone-600">— {importResult.feesSkipped} orders already had fee breakdowns (kept)</p>
                )}
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-rose-700 mb-1">{importResult.errors.length} error(s):</p>
                  <div className="max-h-32 overflow-y-auto bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-700 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="break-words">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {importResult?.error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <p className="font-semibold text-rose-900">Import Failed</p>
              </div>
              <p className="text-sm text-rose-800">{importResult.error}</p>
            </div>
          )}
        </div>

        {!preview && !importing && importResult && (
          <Button onClick={handleClose} variant="outline" className="w-full">
            Done
          </Button>
        )}

        {preview && !importResult && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setPreview(null); setPendingData(null); }} className="flex-1">
              Cancel
            </Button>
            <Button onClick={confirmImport} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
              Confirm Import
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Import Etsy Payment Account CSV</DialogTitle>
          <DialogDescription>
            Upload your Etsy Payment Account CSV to update per-order refund amounts, set channel info, and populate lump-sum fees for orders without a Monthly Statement fee breakdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />

          {!importing && !preview && !importResult && (
            <Button onClick={() => fileInputRef.current?.click()} className="w-full" variant="outline" size="lg">
              <Upload className="w-5 h-5 mr-2" />
              Select Payment Account CSV
            </Button>
          )}

          {importing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Processing payment account data...</p>
            </div>
          )}

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Import Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-stone-900">Rows with Order IDs</p>
                  <p className="text-2xl font-semibold text-emerald-600">{preview.count}</p>
                  <p className="text-xs text-stone-500 mt-1">Rows will be matched to existing orders by Order ID</p>
                </div>
              </CardContent>
            </Card>
          )}

          {importResult && !importResult.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="font-semibold text-emerald-900">Import Successful</p>
              </div>
              <div className="text-sm text-emerald-800 space-y-1">
                <p>✓ {importResult.matched} orders matched</p>
                {importResult.unmatched > 0 && (
                  <p className="text-stone-600">— {importResult.unmatched} rows had no matching order (skipped)</p>
                )}
                {importResult.refundsUpdated > 0 && (
                  <p>✓ {importResult.refundsUpdated} refund amounts updated</p>
                )}
                {importResult.channelSet > 0 && (
                  <p>✓ {importResult.channelSet} channel fields populated</p>
                )}
                {importResult.feesCreated > 0 && (
                  <p>✓ {importResult.feesCreated} fee records created (lump-sum processing fees)</p>
                )}
                {importResult.feesSkipped > 0 && (
                  <p className="text-stone-600">— {importResult.feesSkipped} orders already had fee breakdowns (kept)</p>
                )}
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-rose-700 mb-1">{importResult.errors.length} error(s):</p>
                  <div className="max-h-32 overflow-y-auto bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-700 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="break-words">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {importResult?.error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <p className="font-semibold text-rose-900">Import Failed</p>
              </div>
              <p className="text-sm text-rose-800">{importResult.error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {preview && !importResult && (
            <>
              <Button variant="outline" onClick={() => { setPreview(null); setPendingData(null); }}>
                Cancel
              </Button>
              <Button onClick={confirmImport} className="bg-emerald-600 hover:bg-emerald-700">
                Confirm Import
              </Button>
            </>
          )}
          {!preview && !importing && (
            <Button onClick={handleClose} variant="outline">
              {importResult ? "Done" : "Cancel"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}