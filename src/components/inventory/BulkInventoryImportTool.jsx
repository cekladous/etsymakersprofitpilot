import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";

const TEMPLATE_HEADERS = ["Material Name", "Quantity", "Reorder Level"];

export default function BulkInventoryImportTool() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const csv = [
      TEMPLATE_HEADERS.join(","),
      '"Acrylic 3mm",10,2',
      '"Wood 3mm",25,5',
      '"Leather 2mm",15,3',
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    }
    return rows;
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const text = await file.text();
      const rows = parseCSV(text);
      const created = { inventory: 0, errors: [] };

      for (const row of rows) {
        try {
          await base44.entities.InventoryItem.create({
            owner_user_id: user.id,
            material_name: row["Material Name"],
            quantity_on_hand: parseInt(row["Quantity"]) || 0,
            reorder_level: parseInt(row["Reorder Level"]) || 0,
            reorder_quantity: parseInt(row["Quantity"]) || 0,
          });
          created.inventory++;
        } catch (error) {
          created.errors.push(`Row "${row["Material Name"]}": ${error.message}`);
        }
      }

      return created;
    },
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setFile(null);
    },
  });

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleImport = () => {
    if (!file) return;
    setImporting(true);
    importMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bulk Inventory Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-stone-600 mb-3">Download the template, fill in your inventory levels, then upload to import in bulk.</p>
            <Button onClick={downloadTemplate} variant="outline" className="w-full gap-2">
              <Download className="w-4 h-4" />
              Download CSV Template
            </Button>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-stone-700 mb-2">Upload CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
            />
            {file && <p className="text-xs text-stone-500 mt-2">Selected: {file.name}</p>}
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || importMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Upload className="w-4 h-4" />
            {importMutation.isPending ? "Importing..." : "Import Inventory"}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card className={results.errors.length === 0 ? "bg-emerald-50 border-emerald-200" : "bg-yellow-50 border-yellow-200"}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {results.errors.length === 0 ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              )}
              <CardTitle className="text-base">Import Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>✓ Inventory Items Created: <span className="font-semibold">{results.inventory}</span></div>
            {results.errors.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold text-yellow-800 mb-2">Errors:</p>
                <ul className="space-y-1">
                  {results.errors.map((error, idx) => (
                    <li key={idx} className="text-xs text-yellow-700">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}