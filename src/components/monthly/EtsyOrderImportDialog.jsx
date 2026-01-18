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
import { Upload, Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";
// xlsx imported dynamically in handleFileUpload

// Helper functions for parsing Etsy CSV data
const getVal = (row, header) => row[header];

const toStringSafe = (v) => String(v ?? "").trim();

const parseMoney = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const str = toStringSafe(v).replace(/[$,]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const parseIntSafe = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const num = parseInt(toStringSafe(v));
  return isNaN(num) ? 0 : num;
};

const parseEtsyDateToISO = (v) => {
  if (!v) return "";
  
  // If it's already a Date object
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    const year = v.getFullYear();
    const month = String(v.getMonth() + 1).padStart(2, "0");
    const day = String(v.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  // If it's an Excel serial number (days since 1900-01-01)
  if (typeof v === "number") {
    const date = XLSX.SSF.parse_date_code(v);
    if (!date) return "";
    const year = date.y;
    const month = String(date.m).padStart(2, "0");
    const day = String(date.d).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  // If it's a string, try to parse it
  if (typeof v === "string") {
    const str = v.trim();
    if (!str) return "";
    
    // Try parsing common formats
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  
  return "";
};

export default function EtsyOrderImportDialog({ open, onOpenChange }) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [skippedRows, setSkippedRows] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ orders, fees, fileName }) => {
      // Create import batch
      const batch = await base44.entities.OrderImportBatch.create({
        source_file_name: fileName,
        imported_at: new Date().toISOString(),
        row_count: orders.length,
        channel: "etsy",
        status: "success",
      });

      // Check for duplicates BEFORE importing
      const existingOrders = await base44.entities.EtsyOrder.list();
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const order of orders) {
        const existing = existingOrders.find(o => o.order_id === order.order_id);

        if (existing) {
          // Skip duplicates completely
          skipped++;
          continue;
        }

        // Create new order only if not duplicate
        const newOrder = await base44.entities.EtsyOrder.create({ 
          ...order, 
          import_batch_id: batch.id 
        });
        
        // Create associated fees if provided
        const feeData = fees.find(f => f.order_id === order.order_id);
        if (feeData) {
          await base44.entities.OrderFee.create({ ...feeData, order_id: newOrder.id });
        }
        created++;
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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setConfirmDialogOpen(true);
    event.target.value = "";
  };

  const processFile = async () => {
    if (!pendingFile) return;

    setConfirmDialogOpen(false);
    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = (await import("xlsx")).default;
        window.XLSX = XLSX; // Make XLSX available globally for date parsing
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

        // Transform to EtsyOrder schema with validation
        const orders = [];
        const fees = [];
        const skipped = [];

        jsonData.forEach((row, index) => {
          // Parse and validate Order Date
          const orderDateRaw = getVal(row, "Order Date") || getVal(row, "Sale Date");
          const sale_date = parseEtsyDateToISO(orderDateRaw);
          
          if (!sale_date) {
            skipped.push({
              rowIndex: index + 2,
              reason: "Invalid or missing Order Date",
              data: row,
            });
            return;
          }

          const order_id = toStringSafe(getVal(row, "Order ID"));
          if (!order_id) {
            skipped.push({
              rowIndex: index + 2,
              reason: "Missing Order ID",
              data: row,
            });
            return;
          }

          const order_value = parseMoney(getVal(row, "Order Value"));
          const shipping_charged = parseMoney(getVal(row, "Shipping"));
          const discount_amount = parseMoney(getVal(row, "Discount Amount"));
          const sales_tax = parseMoney(getVal(row, "Sales Tax"));
          const card_processing_fees = parseMoney(getVal(row, "Card Processing Fees"));
          const order_total = parseMoney(getVal(row, "Order Total"));
          const order_net = parseMoney(getVal(row, "Order Net"));

          orders.push({
            sale_date,
            order_id,
            buyer_username: toStringSafe(getVal(row, "Buyer User ID")),
            buyer_full_name: toStringSafe(getVal(row, "Full Name")),
            number_of_items: parseIntSafe(getVal(row, "Number of Items")),
            payment_method: toStringSafe(getVal(row, "Payment Method")),
            order_value,
            coupon_code: toStringSafe(getVal(row, "Coupon Code")),
            discount_amount,
            shipping_charged,
            sales_tax,
            order_total,
            card_processing_fees,
            order_net,
            status: toStringSafe(getVal(row, "Status")) || "completed",
          });

          // Extract fees from Etsy CSV if available
          fees.push({
            order_id,
            listing_fees: parseMoney(getVal(row, "Listing Fee")),
            transaction_fees: parseMoney(getVal(row, "Transaction Fee")),
            processing_fees: card_processing_fees,
            share_save_refunds_credits: parseMoney(getVal(row, "Share & Save")),
            other_fees: parseMoney(getVal(row, "Other Fees")),
            etsy_ads: parseMoney(getVal(row, "Etsy Ads")),
            offsite_ads_fees: parseMoney(getVal(row, "Offsite Ads")),
            etsy_shipping: parseMoney(getVal(row, "Etsy Shipping Label")),
            other_postage_costs: parseMoney(getVal(row, "Other Postage")),
            total_fees: parseMoney(getVal(row, "Listing Fee")) + 
                       parseMoney(getVal(row, "Transaction Fee")) +
                       card_processing_fees +
                       parseMoney(getVal(row, "Other Fees")) +
                       parseMoney(getVal(row, "Etsy Ads")) +
                       parseMoney(getVal(row, "Offsite Ads")),
          });
        });

        setSkippedRows(skipped);
        importMutation.mutate({ orders, fees, fileName: pendingFile.name });
      } catch (error) {
        setImportResult({ error: `Failed to parse file: ${error.message}` });
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(pendingFile);
  };

  const handleClose = () => {
    setImportResult(null);
    setSkippedRows([]);
    setPendingFile(null);
    setConfirmDialogOpen(false);
    onOpenChange(false);
  };

  const downloadSkippedReport = async () => {
    const XLSX = (await import("xlsx")).default;
    const report = skippedRows.map(s => ({
      "Row": s.rowIndex,
      "Reason": s.reason,
      "Order ID": s.data["Order ID"] || "",
      "Order Date": s.data["Order Date"] || "",
      "Buyer": s.data["Full Name"] || "",
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Skipped Rows");
    XLSX.writeFile(workbook, "etsy-import-skipped-rows.xlsx");
  };

  return (
    <>
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              Are you sure you want to import this file? Duplicate orders will be automatically skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfirmDialogOpen(false);
              setPendingFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={processFile} className="bg-emerald-600 hover:bg-emerald-700">
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
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
                <p>✓ Created: {importResult.created} new orders</p>
                <p>↻ Updated: {importResult.updated} existing orders</p>
                <p>⊗ Skipped: {importResult.skipped} errors</p>
                {skippedRows.length > 0 && (
                  <p>⚠ Invalid rows: {skippedRows.length}</p>
                )}
                <p className="font-semibold pt-2 border-t border-emerald-300 mt-2">Total: {importResult.total} rows processed</p>
              </div>
              {skippedRows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSkippedReport}
                  className="mt-3"
                >
                  <Download className="w-3 h-3 mr-2" />
                  Download Skipped Rows Report
                </Button>
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

        <DialogFooter>
          <Button onClick={handleClose} variant={importResult ? "default" : "outline"}>
            {importResult ? "Done" : "Cancel"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}