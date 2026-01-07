import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

export default function EtsyOrderImportDialog({ open, onOpenChange }) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ orders, fileName }) => {
      // Create import batch
      const batch = await base44.entities.OrderImportBatch.create({
        source_file_name: fileName,
        imported_at: new Date().toISOString(),
        row_count: orders.length,
        channel: "etsy",
        status: "success",
      });

      // Check for duplicates and create/update orders
      const existingOrders = await base44.entities.EtsyOrder.list();
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const order of orders) {
        const isDuplicate = existingOrders.find(
          (o) =>
            o.order_id === order.order_id &&
            o.sale_date === order.sale_date &&
            Math.abs((o.order_value || 0) - (order.order_value || 0)) < 0.01
        );

        if (isDuplicate) {
          skipped++;
        } else {
          await base44.entities.EtsyOrder.create({ ...order, import_batch_id: batch.id });
          created++;
        }
      }

      return { created, updated, skipped, total: orders.length };
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      setImporting(false);
    },
    onError: (error) => {
      setImportResult({ error: error.message });
      setImporting(false);
    },
  });

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Transform to EtsyOrder schema
        const orders = jsonData.map((row) => ({
          sale_date: row["Order Date"] || row["Sale Date"] || row.sale_date,
          order_id: row["Order ID"]?.toString() || row.order_id?.toString(),
          buyer_username: row["Buyer User ID"] || row["Buyer"] || row.buyer_username,
          buyer_full_name: row["Full Name"] || row.buyer_full_name,
          number_of_items: parseInt(row["Number of Items"] || row.number_of_items || 1),
          payment_method: row["Payment Method"] || row.payment_method,
          order_value: parseFloat(row["Order Value"] || row.order_value || 0),
          coupon_code: row["Coupon Code"] || row.coupon_code || "",
          discount_amount: parseFloat(row["Discount Amount"] || row.discount_amount || 0),
          shipping_charged: parseFloat(row["Shipping"] || row.shipping_charged || 0),
          sales_tax: parseFloat(row["Sales Tax"] || row.sales_tax || 0),
          order_total: parseFloat(row["Order Total"] || row.order_total || 0),
          card_processing_fees: parseFloat(row["Card Processing Fees"] || row.card_processing_fees || 0),
          order_net: parseFloat(row["Order Net"] || row.order_net || 0),
          status: row["Status"] || row.status || "completed",
        }));

        importMutation.mutate({ orders, fileName: file.name });
      } catch (error) {
        setImportResult({ error: `Failed to parse file: ${error.message}` });
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handleClose = () => {
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Etsy Orders</DialogTitle>
          <DialogDescription>
            Upload your Etsy sold orders CSV or Excel file. Duplicates will be automatically skipped.
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

          {!importing && !importResult && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select File
            </Button>
          )}

          {importing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Importing orders...</p>
            </div>
          )}

          {importResult && !importResult.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="font-semibold text-emerald-900">Import Successful</p>
              </div>
              <div className="text-sm text-emerald-800 space-y-1">
                <p>✓ Created: {importResult.created} orders</p>
                <p>⊗ Skipped: {importResult.skipped} duplicates</p>
                <p>Total: {importResult.total} rows processed</p>
              </div>
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

        <DialogFooter>
          <Button onClick={handleClose} variant={importResult ? "default" : "outline"}>
            {importResult ? "Done" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}