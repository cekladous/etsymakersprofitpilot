import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Eye, Download } from "lucide-react";

export default function CSVImporter({
  open,
  onOpenChange,
  title,
  description,
  onImport,
  validateRow,
  parseRow,
  getUniqueKey
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const fileInputRef = useRef(null);

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return { headers: [], rows: [] };
    
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((h, j) => {
          row[h] = values[j]?.replace(/^"|"$/g, "") || "";
        });
        rows.push(row);
      }
    }
    
    return { headers, rows };
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const { headers, rows } = parseCSV(text);
      setPreview({ headers, rows: rows.slice(0, 5), totalRows: rows.length });
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      
      const importResult = await onImport(rows, parseRow, getUniqueKey, validateRow);
      setResult(importResult);
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        added: 0,
        updated: 0,
        skipped: 0
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setShowSkipped(false);
    onOpenChange(false);
  };

  const exportSkipped = () => {
    if (!result?.skippedRecords) return;
    
    const headers = result.skippedRecords[0]?.row ? Object.keys(result.skippedRecords[0].row).concat(["Skip Reason"]) : [];
    const rows = result.skippedRecords.map(sr => {
      const rowValues = Object.values(sr.row || {});
      return [...rowValues, sr.reason].join(",");
    });
    
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skipped-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6">
            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? "border-emerald-300 bg-emerald-50" : "border-stone-200 hover:border-stone-300"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-medium text-stone-900">{file.name}</p>
                    <p className="text-sm text-stone-500">
                      {preview?.totalRows} rows ready to import
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                  <p className="text-stone-600 font-medium">Click to upload CSV</p>
                  <p className="text-sm text-stone-400 mt-1">or drag and drop</p>
                </>
              )}
            </div>

            {/* Preview Table */}
            {preview && preview.rows.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 border-b">
                  <p className="text-sm font-medium text-stone-600">
                    Preview (first 5 rows of {preview.totalRows})
                  </p>
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50">
                      <tr>
                        {preview.headers.slice(0, 6).map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-stone-600 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                        {preview.headers.length > 6 && (
                          <th className="px-3 py-2 text-stone-400">...</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-t">
                          {preview.headers.slice(0, 6).map((h, j) => (
                            <td key={j} className="px-3 py-2 text-stone-700 whitespace-nowrap max-w-32 truncate">
                              {row[h]}
                            </td>
                          ))}
                          {preview.headers.length > 6 && (
                            <td className="px-3 py-2 text-stone-400">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Results */
          <div className="py-6">
            {result.success ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-4">Import Complete</h3>
                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-emerald-600">{result.added}</p>
                    <p className="text-sm text-stone-600">Added</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                    <p className="text-sm text-stone-600">Updated</p>
                  </div>
                  <div className="bg-stone-100 rounded-xl p-4">
                    <p className="text-2xl font-bold text-stone-600">{result.skipped}</p>
                    <p className="text-sm text-stone-600">Skipped</p>
                  </div>
                </div>
                
                {result.skipped > 0 && result.skippedRecords && result.skippedRecords.length > 0 && (
                  <div className="mt-6 flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSkipped(true)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Skipped Records
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportSkipped}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Skipped
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-rose-600" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">Import Failed</h3>
                <p className="text-stone-500">{result.error}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || importing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="bg-emerald-600 hover:bg-emerald-700">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Skipped Records Sheet */}
      <Sheet open={showSkipped} onOpenChange={setShowSkipped}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Skipped Records ({result?.skipped || 0})</SheetTitle>
            <SheetDescription>
              These rows were skipped during import due to missing data or duplicates.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {result?.skippedRecords?.map((sr, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-stone-50">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-semibold text-stone-500">Row {idx + 1}</span>
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded">
                    {sr.reason}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {Object.entries(sr.row || {}).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-stone-500 min-w-32 truncate">{key}:</span>
                      <span className="text-stone-900 truncate">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              onClick={exportSkipped}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Export All Skipped
            </Button>
            <Button
              onClick={() => setShowSkipped(false)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Dialog>
  );
}