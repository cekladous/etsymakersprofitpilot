import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";

const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return format(val, 'yyyy-MM-dd');
  const str = String(val).trim();
  const date = new Date(str);
  if (!isNaN(date.getTime())) return format(date, 'yyyy-MM-dd');
  return null;
};

const parseMoney = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const str = String(v ?? "").trim();
  const cleaned = str.replace(/[$(),\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function EtsyPaymentDepositsImport({ open, onOpenChange, embedded = false }) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ fileName, parsedData }) => {
      const { deposits } = parsedData;
      const currentUser = await base44.auth.me();
      
      const importRecord = await base44.entities.EtsyStatementImport.create({
        owner_user_id: currentUser.id,
        import_id: `deposit_import_${Date.now()}`,
        statement_month: deposits[0]?.deposit_date?.substring(0, 7) || format(new Date(), 'yyyy-MM'),
        date_range_start: deposits[0]?.deposit_date,
        date_range_end: deposits[deposits.length - 1]?.deposit_date,
        file_name: fileName,
        imported_at: new Date().toISOString(),
        status: 'success',
        deposits_count: deposits.length,
      });

      let created = 0;
      // Deduplicate: check existing deposits to avoid re-importing
      const existingDeposits = await base44.entities.EtsyDeposit.filter({ owner_user_id: currentUser.id });
      const existingKeys = new Set(existingDeposits.map(d => `${d.deposit_date}|${Math.abs(d.amount || 0).toFixed(2)}`));
      const uniqueDeposits = deposits.filter(d => {
        const key = `${d.deposit_date}|${Math.abs(d.amount || 0).toFixed(2)}`;
        return !existingKeys.has(key);
      });
      
      for (const deposit of uniqueDeposits) {

        try {
          await base44.entities.EtsyDeposit.create({
            ...deposit,
            owner_user_id: currentUser.id,
            import_batch_id: importRecord.id,
            source_file: fileName,
            imported_at: new Date().toISOString(),
          });
          created++;
        } catch (err) {
          console.error('Failed to create deposit:', err);
        }
      }

      await base44.entities.EtsyStatementImport.update(importRecord.id, {
        deposits_count: created,
      });

      return { created, total: deposits.length, skipped: deposits.length - uniqueDeposits.length };

    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-payment-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
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
        const XLSX = await import("xlsx");
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

        if (jsonData.length === 0) {
          setImportResult({ error: "File is empty or contains no data rows." });
          setImporting(false);
          return;
        }

        const firstRow = jsonData[0];
        const requiredColumns = ['Date', 'Amount'];
        const missingColumns = requiredColumns.filter(col => !firstRow.hasOwnProperty(col));
        
        if (missingColumns.length > 0) {
          setImportResult({ error: `Missing required columns: ${missingColumns.join(', ')}. Expected: Date, Amount, Currency, Type` });
          setImporting(false);
          return;
        }

        const deposits = jsonData.map(row => ({
          deposit_date: parseDate(row["Date"]),
          amount: parseMoney(row["Amount"]),
          currency: row["Currency"] || "USD",
          type: row["Type"] || "deposit",
          description: row["Description"] || "",
        })).filter(d => d.deposit_date && d.amount !== 0);

        setPreview({ count: deposits.length });
        setPendingData({ fileName: file.name, parsedData: { deposits } });
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
          <DialogTitle>Import Etsy Payment Deposits</DialogTitle>
          <DialogDescription>
            Upload your Etsy Payment Deposits CSV to track deposits for reconciliation.
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
              Select Etsy Payment Deposits File
            </Button>
          )}

          {importing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Analyzing deposits...</p>
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
                  <p className="text-sm font-medium text-stone-900">Deposits Found</p>
                  <p className="text-2xl font-semibold text-emerald-600">{preview.count}</p>
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
              <p className="text-sm text-emerald-800">
                ✓ {importResult.created} of {importResult.total} imported{importResult.skipped > 0 ? ` (${importResult.skipped} duplicates skipped)` : ''}

              </p>
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
          <DialogTitle>Import Etsy Payment Deposits</DialogTitle>
          <DialogDescription>
            Upload your Etsy Payment Deposits CSV to track deposits for reconciliation.
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
              Select Etsy Payment Deposits File
            </Button>
          )}

          {importing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Analyzing deposits...</p>
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
                  <p className="text-sm font-medium text-stone-900">Deposits Found</p>
                  <p className="text-2xl font-semibold text-emerald-600">{preview.count}</p>
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
              <p className="text-sm text-emerald-800">
                ✓ {importResult.created} of {importResult.total} imported{importResult.skipped > 0 ? ` (${importResult.skipped} duplicates skipped)` : ''}

              </p>
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