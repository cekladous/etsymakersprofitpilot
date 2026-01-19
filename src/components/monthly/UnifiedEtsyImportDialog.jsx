import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle, Download, Eye, FileText } from "lucide-react";

// Shared helper functions
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
  if (!v) return null;
  
  if (v instanceof Date) {
    return v.toISOString().split("T")[0];
  }
  
  if (typeof v === "number") {
    const date = new Date((v - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  
  const str = toStringSafe(v);
  
  // Try DD-MMM-YY format (e.g., "31-Dec-25")
  const ddmmmyy = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (ddmmmyy) {
    const [, day, monthStr, year] = ddmmmyy;
    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = months[monthStr.toLowerCase()];
    if (month) {
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      return `${fullYear}-${month}-${day.padStart(2, "0")}`;
    }
  }
  
  const mmddyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  const yyyymmdd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }
  
  return null;
};

// File type detection
const detectFileType = (headers) => {
  const headerStr = headers.map(h => h.toLowerCase()).join(",");
  
  // Check for sold orders CSV columns
  if (headerStr.includes("order id") && headerStr.includes("buyer") && headerStr.includes("order value")) {
    return "sold_orders";
  }
  
  // Check for payment ledger columns
  if (headerStr.includes("type") && headerStr.includes("title") && headerStr.includes("info")) {
    return "payment_ledger";
  }
  
  return "unknown";
};

export default function UnifiedEtsyImportDialog({ open, onOpenChange }) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [skippedRows, setSkippedRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ orders, fees, ledgerEntries, transfers, fileName, fileType }) => {
      const result = {
        orders: { created: 0, skipped: 0 },
        ledger: { created: 0, skipped: 0 },
        transfers: { created: 0 }
      };

      // Import orders if present
      if (orders && orders.length > 0) {
        const existingOrders = await base44.entities.EtsyOrder.list();
        
        for (const order of orders) {
          const existing = existingOrders.find(o => o.order_id === order.order_id);
          if (existing) {
            result.orders.skipped++;
            continue;
          }
          
          const newOrder = await base44.entities.EtsyOrder.create(order);
          
          const feeData = fees.find(f => f.order_id === order.order_id);
          if (feeData) {
            await base44.entities.OrderFee.create({ ...feeData, order_id: newOrder.id });
          }
          result.orders.created++;
        }
      }

      // Import ledger entries if present
      if (ledgerEntries && ledgerEntries.length > 0) {
        // Create batch for ledger entries
        const batch = await base44.entities.OrderImportBatch.create({
          source_file_name: fileName,
          row_count: ledgerEntries.length,
          channel: "etsy_ledger",
          status: "success",
        });

        const existingEntries = await base44.entities.EtsyLedgerEntry.list("-entry_date", 10000);
        result.existingEntriesCount = existingEntries.length;

        for (const entry of ledgerEntries) {
          // Check if this exact entry already exists (by all key fields)
          const duplicate = existingEntries.find(e => 
            e.entry_date === entry.entry_date &&
            e.type === entry.type &&
            e.title === entry.title &&
            Math.abs((e.amount || 0) - (entry.amount || 0)) < 0.01 &&
            Math.abs((e.net || 0) - (entry.net || 0)) < 0.01
          );
          
          if (duplicate) {
            result.ledger.skipped++;
            continue;
          }
          
          await base44.entities.EtsyLedgerEntry.create({ ...entry, source_batch_id: batch.id });
          result.ledger.created++;
        }
      }

      // Import transfers if present
      if (transfers && transfers.length > 0) {
        for (const transfer of transfers) {
          await base44.entities.Transfer.create(transfer);
          result.transfers.created++;
        }
      }

      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-ledger-entries"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
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
    setPendingFile(file);
    setConfirmDialogOpen(true);
    event.target.value = "";
  };

  const processFile = async () => {
    if (!pendingFile) return;
    
    setConfirmDialogOpen(false);
    setImporting(true);
    setImportResult(null);
    setSkippedRows([]);

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
          setImportResult({ error: "File is empty" });
          setImporting(false);
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const fileType = detectFileType(headers);

        if (fileType === "sold_orders") {
          await processSoldOrders(jsonData, pendingFile.name);
        } else if (fileType === "payment_ledger") {
          await processPaymentLedger(jsonData, pendingFile.name);
        } else {
          setImportResult({ error: "Unknown file format. Please upload Etsy Sold Orders or Payment Ledger CSV." });
          setImporting(false);
        }
      } catch (error) {
        setImportResult({ error: `Failed to parse file: ${error.message}` });
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(pendingFile);
  };

  const processSoldOrders = async (jsonData, fileName) => {
    const orders = [];
    const fees = [];
    const skipped = [];

    jsonData.forEach((row, index) => {
      const orderDateRaw = getVal(row, "Order Date") || getVal(row, "Sale Date");
      const sale_date = parseEtsyDateToISO(orderDateRaw);
      
      if (!sale_date) {
        skipped.push({ rowIndex: index + 2, reason: "Invalid or missing Order Date", data: row });
        return;
      }

      const order_id = toStringSafe(getVal(row, "Order ID"));
      if (!order_id) {
        skipped.push({ rowIndex: index + 2, reason: "Missing Order ID", data: row });
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
    importMutation.mutate({ orders, fees, ledgerEntries: null, transfers: null, fileName, fileType: "sold_orders" });
  };

  const processPaymentLedger = async (jsonData, fileName) => {
    const ledgerEntries = [];
    const transfers = [];
    const skipped = [];

    jsonData.forEach((row, index) => {
      const dateRaw = getVal(row, "Date");
      const entry_date = parseEtsyDateToISO(dateRaw);
      
      if (!entry_date) {
        skipped.push({ rowIndex: index + 2, reason: "Invalid or missing Date", data: row });
        return;
      }

      const type = toStringSafe(getVal(row, "Type"));
      const title = toStringSafe(getVal(row, "Title"));
      const info = toStringSafe(getVal(row, "Info"));
      const amount = parseMoney(getVal(row, "Amount"));
      const fees_taxes = parseMoney(getVal(row, "Fees & Taxes"));
      const net = parseMoney(getVal(row, "Net"));

      // Detect deposits and create transfers
      if (type.toLowerCase() === "deposit") {
        const depositMatch = info.match(/\$?([\d,]+\.\d{2})/);
        if (depositMatch) {
          const depositAmount = parseFloat(depositMatch[1].replace(/,/g, ""));
          transfers.push({
            date: entry_date,
            type: "etsy_deposit",
            amount: depositAmount,
            notes: `${title} - ${info}`,
          });
        }
      }

      ledgerEntries.push({
        entry_date,
        type,
        title,
        info,
        currency: toStringSafe(getVal(row, "Currency")),
        amount,
        fees_taxes,
        net,
        tax_details: toStringSafe(getVal(row, "Tax Details")),
      });
    });

    setSkippedRows(skipped);
    importMutation.mutate({ orders: null, fees: null, ledgerEntries, transfers, fileName, fileType: "payment_ledger" });
  };

  const downloadSkippedReport = async () => {
    const xlsxModule = await import("xlsx");
    const XLSX = xlsxModule.default || xlsxModule;
    const report = skippedRows.map(s => ({
      "Row": s.rowIndex,
      "Reason": s.reason,
      ...s.data,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Skipped Rows");
    XLSX.writeFile(workbook, "etsy-import-skipped-rows.xlsx");
  };

  const handleClose = () => {
    setImportResult(null);
    setSkippedRows([]);
    setPendingFile(null);
    setConfirmDialogOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              Import this file? The system will auto-detect if it's Sold Orders or Payment Ledger data.
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

      {/* Main Import Dialog */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Etsy Data</DialogTitle>
            <DialogDescription>
              Upload Sold Orders CSV or Payment Ledger - automatically detected and processed.
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
                <p className="text-sm text-stone-600">Processing import...</p>
              </div>
            )}

            {importResult && !importResult.error && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="font-semibold text-emerald-900">Import Successful</p>
                </div>
                <div className="text-sm text-emerald-800 space-y-1">
                  {importResult.orders && (
                    <>
                      <p>✓ Orders created: {importResult.orders.created}</p>
                      <p>⊗ Orders skipped: {importResult.orders.skipped}</p>
                    </>
                  )}
                  {importResult.ledger && (
                    <>
                      <p>✓ Ledger entries created: {importResult.ledger.created}</p>
                      {importResult.ledger.skipped > 0 && (
                        <div className="text-amber-700">
                          <p>⊗ Ledger entries skipped: {importResult.ledger.skipped} (duplicates detected)</p>
                          <p className="text-sm mt-1">Database has {importResult.existingEntriesCount || 0} existing ledger entries. To re-import, delete existing entries first from the Orders page.</p>
                        </div>
                      )}
                    </>
                  )}
                  {importResult.transfers && importResult.transfers.created > 0 && (
                    <p>✓ Deposits tracked: {importResult.transfers.created}</p>
                  )}
                  {skippedRows.length > 0 && (
                    <p>⚠ Invalid rows: {skippedRows.length}</p>
                  )}
                </div>
                
                {skippedRows.length > 0 && (
                  <>
                    <div className="border rounded-lg max-h-64 overflow-auto mt-4">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium text-stone-600">Row</th>
                            <th className="text-left p-2 font-medium text-stone-600">Reason</th>
                            <th className="text-right p-2 font-medium text-stone-600">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skippedRows.map((skip, idx) => (
                            <tr key={idx} className="border-t hover:bg-stone-50">
                              <td className="p-2 text-stone-900">{skip.rowIndex}</td>
                              <td className="p-2 text-rose-600">{skip.reason}</td>
                              <td className="p-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRow(skip);
                                    setDetailSheetOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={downloadSkippedReport}
                      className="w-full mt-3"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Skipped Rows Report
                    </Button>
                  </>
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

      {/* Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="overflow-auto">
          <SheetHeader>
            <SheetTitle>Row {selectedRow?.rowIndex} Details</SheetTitle>
            <SheetDescription>
              Skipped: {selectedRow?.reason}
            </SheetDescription>
          </SheetHeader>
          
          {selectedRow && (
            <div className="mt-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-rose-900">Skip Reason</p>
                <p className="text-sm text-rose-700 mt-1">{selectedRow.reason}</p>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-semibold text-stone-900">Raw Data</h3>
                
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(selectedRow.data).map(([key, value]) => (
                    <div key={key} className="border rounded-lg p-3">
                      <p className="text-xs text-stone-500 mb-1">{key}</p>
                      <p className="text-sm font-medium text-stone-900">
                        {value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}