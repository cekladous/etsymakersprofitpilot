import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";

const TEMPLATE_HEADERS = ["SKU", "Product Name", "Default Material", "Area per Unit (sq in)", "Laser Minutes per Unit", "Packaging Cost", "Initial Inventory Quantity"];

export default function BulkProductImportTool() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const csv = [
      TEMPLATE_HEADERS.join(","),
      'SKU001,"Custom Acrylic Sign",Acrylic 3mm,120,15,0.50,10',
      'SKU002,"Wooden Coaster Set",Wood 3mm,8,5,0.25,25',
      'SKU003,"Metal Keychain",Acrylic 3mm,2,2,0.10,50',
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-inventory-template.csv";
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
      const created = { products: 0, inventory: 0, errors: [] };

      for (const row of rows) {
        try {
          const product = await base44.entities.Product.create({
            sku: row["SKU"],
            name: row["Product Name"],
            default_material_id: row["Default Material"] || "",
            area_per_unit: parseFloat(row["Area per Unit (sq in)"]) || 0,
            laser_minutes_per_unit: parseFloat(row["Laser Minutes per Unit"]) || 0,
            packaging_cost: parseFloat(row["Packaging Cost"]) || 0,
            active: true,
          });

          const inventoryQty = parseInt(row["Initial Inventory Quantity"]) || 0;
          if (inventoryQty > 0) {
            await base44.entities.InventoryItem.create({
              sku: row["SKU"],
              product_id: product.id,
              quantity_on_hand: inventoryQty,
              reorder_level: Math.ceil(inventoryQty * 0.2),
              reorder_quantity: inventoryQty,
            });
            created.inventory++;
          }
          created.products++;
        } catch (error) {
          created.errors.push(`Row "${row["SKU"]}": ${error.message}`);
        }
      }

      return created;
    },
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
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
          <CardTitle className="text-lg">Bulk Product & Inventory Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-stone-600 mb-3">Download the template, fill in your products and inventory, then upload to import in bulk.</p>
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
            {importMutation.isPending ? "Importing..." : "Import Products"}
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
            <div>✓ Products Created: <span className="font-semibold">{results.products}</span></div>
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