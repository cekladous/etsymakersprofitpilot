import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Upload, Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";
// xlsx imported dynamically in handleImport

// Parsing helpers
const getVal = (row, header) => {
  const keys = Object.keys(row);
  const key = keys.find(k => k.toLowerCase().includes(header.toLowerCase()));
  return key ? row[key] : "";
};

const toStringSafe = (v) => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

const parseMoney = (v) => {
  if (!v) return 0;
  const str = toStringSafe(v);
  // Remove $, commas, and parentheses (negative values)
  let cleaned = str.replace(/[\$,]/g, "");
  const isNegative = cleaned.includes("(") && cleaned.includes(")");
  cleaned = cleaned.replace(/[()]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : (isNegative ? -Math.abs(num) : num);
};

const parseEtsyDateToISO = (v) => {
  if (!v) return null;
  
  // Handle Date objects
  if (v instanceof Date) {
    return v.toISOString().split("T")[0];
  }
  
  // Handle Excel serial dates
  if (typeof v === "number") {
    const date = new Date((v - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  
  const str = toStringSafe(v);
  
  // Try MM/DD/YYYY
  const mmddyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // Try YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // Try parsing with Date constructor
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }
  
  return null;
};

const extractOrderId = (title, info) => {
  const text = `${title} ${info}`.toLowerCase();
  
  // Pattern: Order #12345 or Order 12345
  const pattern1 = text.match(/order\s*#?\s*(\d+)/i);
  if (pattern1) return pattern1[1];
  
  // Pattern: #12345 (at least 5 digits)
  const pattern2 = text.match(/#(\d{5,})/);
  if (pattern2) return pattern2[1];
  
  // Pattern: order_id: 12345
  const pattern3 = text.match(/order_id[:\s]+(\d+)/i);
  if (pattern3) return pattern3[1];
  
  return "";
};

const matchCategory = (type, title, info) => {
  const text = `${type} ${title} ${info}`.toLowerCase();
  
  // Revenue
  if (text.match(/sale|order|transaction|item price|shipping|payment for order/)) {
    return { category: "revenue", subcategory: "etsy_sales" };
  }
  
  // Listing fees
  if (text.match(/listing|renew|auto-renew|listing fee/)) {
    return { category: "selling_expenses", subcategory: "etsy_listing_fees" };
  }
  
  // Transaction fees
  if (text.match(/transaction fee/)) {
    return { category: "selling_expenses", subcategory: "etsy_transaction_fees" };
  }
  
  // Processing fees
  if (text.match(/processing fee|payment processing|card processing/)) {
    return { category: "selling_expenses", subcategory: "etsy_processing_fees" };
  }
  
  // Refunds & credits
  if (text.match(/credit|adjustment|refund of fee|fee refund/)) {
    return { category: "selling_expenses", subcategory: "share_save_refunds_credits" };
  }
  
  // Etsy Ads
  if (text.match(/etsy ads|advertising/)) {
    return { category: "selling_expenses", subcategory: "etsy_ads" };
  }
  
  // Offsite Ads
  if (text.match(/offsite ads/)) {
    return { category: "selling_expenses", subcategory: "etsy_offsite_ads_fees" };
  }
  
  // Shipping
  if (text.match(/shipping label|postage|etsy shipping/)) {
    return { category: "selling_expenses", subcategory: "etsy_shipping" };
  }
  
  // Other postage
  if (text.match(/postage adjustment|carrier adjustment/)) {
    return { category: "selling_expenses", subcategory: "other_postage_costs" };
  }
  
  // Deposits
  if (text.match(/deposit|payout|transfer to bank/)) {
    return { category: "transfer", subcategory: "etsy_deposit" };
  }
  
  // Other fees (fallback)
  if (text.match(/fee|regulatory|vat on fees/)) {
    return { category: "selling_expenses", subcategory: "other_fees" };
  }
  
  return { category: "unmatched", subcategory: null };
};

export default function EtsyLedgerImportDialog({ open, onOpenChange }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [skippedRows, setSkippedRows] = useState([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ entries, batchData, transfers }) => {
      // Create batch
      const batch = await base44.entities.OrderImportBatch.create({
        ...batchData,
        row_count: entries.length,
      });
      
      // Create ledger entries
      if (entries.length > 0) {
        const entriesWithBatch = entries.map(e => ({ ...e, source_batch_id: batch.id }));
        await base44.entities.EtsyLedgerEntry.bulkCreate(entriesWithBatch);
      }
      
      // Create transfers
      if (transfers.length > 0) {
        await base44.entities.Transfer.bulkCreate(transfers);
      }
      
      return { batch, entries };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-ledger-entries"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["order-import-batches"] });
      setStatus("success");
      setResult({
        imported: data.entries.length,
        skipped: skippedRows.length,
      });
    },
    onError: (error) => {
      setStatus("error");
      setResult({ error: error.message });
    },
  });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus("idle");
      setResult(null);
      setSkippedRows([]);
      setConfirmDialogOpen(true);
    }
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!file) return;
    
    setConfirmDialogOpen(false);
    setStatus("processing");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = (await import("xlsx")).default;
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        // Get existing entries to check for database duplicates
        const existingEntries = await base44.entities.EtsyLedgerEntry.list();
        const existingKeys = new Set(
          existingEntries.map(e => `${e.entry_date}|${e.type}|${e.title}|${e.amount}|${e.net}`)
        );
        
        const entries = [];
        const transfers = [];
        const skipped = [];
        const seen = new Set();
        
        rows.forEach((row, idx) => {
          const date = getVal(row, "date");
          const type = toStringSafe(getVal(row, "type"));
          const title = toStringSafe(getVal(row, "title"));
          const info = toStringSafe(getVal(row, "info"));
          const currency = toStringSafe(getVal(row, "currency"));
          const amount = parseMoney(getVal(row, "amount"));
          const fees_taxes = parseMoney(getVal(row, "fees"));
          const net = parseMoney(getVal(row, "net"));
          const tax_details = toStringSafe(getVal(row, "tax"));
          
          // Parse date
          const entry_date = parseEtsyDateToISO(date);
          if (!entry_date) {
            skipped.push({ rowIndex: idx + 2, reason: "Invalid date", row });
            return;
          }
          
          // Dedupe key
          const dedupeKey = `${entry_date}|${type}|${title}|${amount}|${net}`;
          
          // Check for duplicates in this file
          if (seen.has(dedupeKey)) {
            skipped.push({ rowIndex: idx + 2, reason: "Duplicate in file", row });
            return;
          }
          
          // Check for duplicates in database
          if (existingKeys.has(dedupeKey)) {
            skipped.push({ rowIndex: idx + 2, reason: "Duplicate in database", row });
            return;
          }
          
          seen.add(dedupeKey);
          
          // Extract order ID
          const etsy_order_id = extractOrderId(title, info);
          
          // Match category
          const match = matchCategory(type, title, info);
          
          // Create entry
          const entry = {
            entry_date,
            type,
            title,
            info,
            currency: currency || "USD",
            amount,
            fees_taxes,
            net,
            tax_details,
            etsy_order_id,
            status: match.category === "unmatched" ? "Unmatched" : "Matched",
            matched_category: match.subcategory,
          };
          
          entries.push(entry);
          
          // Create transfer if deposit
          if (match.category === "transfer") {
            transfers.push({
              date: entry_date,
              type: "etsy_deposit",
              amount: Math.abs(net),
              notes: `${title} - ${info}`,
            });
          }
        });
        
        setSkippedRows(skipped);
        
        if (entries.length === 0) {
          setStatus("error");
          setResult({ error: "No valid entries found" });
          return;
        }
        
        // Import
        importMutation.mutate({
          entries,
          transfers,
          batchData: {
            source_file_name: file.name,
            row_count: entries.length,
            channel: "etsy_ledger",
            status: skipped.length > 0 ? "partial" : "success",
            notes: skipped.length > 0 ? `${skipped.length} rows skipped` : "",
          },
        });
      } catch (error) {
        setStatus("error");
        setResult({ error: error.message });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadSkippedReport = async () => {
    const xlsxModule = await import("xlsx");
    const XLSX = xlsxModule.default || xlsxModule;
    const data = skippedRows.map(s => ({
      "Row": s.rowIndex,
      "Reason": s.reason,
      "Date": getVal(s.row, "date"),
      "Type": getVal(s.row, "type"),
      "Title": getVal(s.row, "title"),
      "Info": getVal(s.row, "info"),
      "Currency": getVal(s.row, "currency"),
      "Amount": getVal(s.row, "amount"),
      "Fees & Taxes": getVal(s.row, "fees"),
      "Net": getVal(s.row, "net"),
      "Tax Details": getVal(s.row, "tax"),
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Skipped");
    XLSX.writeFile(wb, "etsy-ledger-skipped-rows.xlsx");
  };

  return (
    <>
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              Are you sure you want to import {file?.name}? Duplicate entries will be automatically skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setConfirmDialogOpen(false);
              setFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700">
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Import Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Etsy Payment Ledger</DialogTitle>
            <DialogDescription>
              Upload your Etsy Payment Account CSV/XLSX with columns: Date, Type, Title, Info, Currency, Amount, Fees & Taxes, Net
            </DialogDescription>
          </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          {status === "idle" && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select File
            </Button>
          )}

          {status === "processing" && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="ml-3 text-stone-600">Processing ledger...</span>
            </div>
          )}

          {status === "success" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Import Successful</p>
                  <p className="text-sm text-emerald-700">
                    ✓ Imported: {result.imported} entries
                    {result.skipped > 0 && <><br/>⊗ Skipped: {result.skipped} rows</>}
                  </p>
                </div>
              </div>
              
              {skippedRows.length > 0 && (
                <Button
                  variant="outline"
                  onClick={downloadSkippedReport}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Skipped Rows Report
                </Button>
              )}
              
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Close
              </Button>
            </div>
          )}

          {status === "error" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-rose-600" />
                <div>
                  <p className="font-semibold text-rose-900">Import Failed</p>
                  <p className="text-sm text-rose-700">{result.error}</p>
                </div>
              </div>
              
              <Button onClick={() => setStatus("idle")} className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}