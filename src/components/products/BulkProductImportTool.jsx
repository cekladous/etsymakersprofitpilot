import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";

const TEMPLATE_HEADERS = ["SKU", "Product Name", "Default Material", "Area per Unit (sq in)", "Laser Minutes per Unit", "Packaging Cost"];

// Meta/Facebook catalog field name -> our Product field
const META_FIELD_MAP = {
  id: "sku",
  title: "name",
  description: "notes",
  price: "sale_price",
  sale_price: "sale_price",
  availability: "_availability",
  condition: "_condition",
};

export default function BulkProductImportTool() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const csv = [
      TEMPLATE_HEADERS.join(","),
      'SKU001,"Custom Acrylic Sign",Acrylic 3mm,120,15,0.50',
      'SKU002,"Wooden Coaster Set",Wood 3mm,8,5,0.25',
      'SKU003,"Metal Keychain",Acrylic 3mm,2,2,0.10',
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Parse a price string like "125 USD" or "125" -> number
  const parsePrice = (val) => {
    if (!val) return 0;
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
    return isNaN(num) ? 0 : num;
  };

  // Read CSV/Excel with xlsx (handles quoted fields, newlines, two header rows)
  const readRows = async (file) => {
    const xlsxModule = await import("xlsx");
    const XLSX = xlsxModule.default || xlsxModule;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // sheet_to_json with header:1 returns array-of-arrays (raw rows)
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return rawRows;
  };

  // Detect format and return { headers, dataRows } from raw rows
  const detectFormat = (rawRows) => {
    if (!rawRows.length) return { format: "unknown", headers: [], dataRows: [] };

    // Find the row that looks like real headers.
    // Meta catalogs have an instructions row (starts with "# Required") then a field-name row.
    let headerRowIdx = 0;
    let candidate = rawRows[0].map((c) => String(c || "").toLowerCase());
    // If first row is the long "# Required" instructions, the next row holds field names (id, title...)
    if (candidate.some((c) => c.startsWith("# required")) && rawRows.length > 1) {
      headerRowIdx = 1;
    }
    const headers = rawRows[headerRowIdx].map((c) => String(c || "").trim());
    const dataRows = rawRows.slice(headerRowIdx + 1).filter((r) =>
      r.some((c) => String(c || "").trim() !== "")
    );

    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const isMeta = lowerHeaders.includes("id") && lowerHeaders.includes("title");
    return { format: isMeta ? "meta" : "template", headers, dataRows };
  };

  const buildProductsFromTemplate = (headers, dataRows) => {
    const get = (row, name) => {
      const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      return idx >= 0 ? String(row[idx] || "").trim() : "";
    };
    return dataRows.map((row) => ({
      sku: get(row, "SKU"),
      name: get(row, "Product Name"),
      default_material_id: get(row, "Default Material") || "",
      area_per_unit: parseFloat(get(row, "Area per Unit (sq in)")) || 0,
      laser_minutes_per_unit: parseFloat(get(row, "Laser Minutes per Unit")) || 0,
      packaging_cost: parseFloat(get(row, "Packaging Cost")) || 0,
      active: true,
    }));
  };

  const buildProductsFromMeta = (headers, dataRows) => {
    const get = (row, name) => {
      const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      return idx >= 0 ? String(row[idx] || "").trim() : "";
    };
    return dataRows.map((row) => {
      const sku = get(row, "id");
      const name = get(row, "title");
      const description = get(row, "description");
      const salePrice = parsePrice(get(row, "price") || get(row, "sale_price"));
      return {
        sku,
        name,
        sale_price: salePrice,
        notes: description,
        active: true,
      };
    }).filter((p) => p.sku && p.name);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const rawRows = await readRows(file);
      const { format, headers, dataRows } = detectFormat(rawRows);
      const products = format === "meta"
        ? buildProductsFromMeta(headers, dataRows)
        : buildProductsFromTemplate(headers, dataRows);

      const created = { products: 0, errors: [], skipped: 0, format };

      for (const p of products) {
        try {
          await base44.entities.Product.create({
            owner_user_id: user.id,
            ...p,
          });
          created.products++;
        } catch (error) {
          if (String(error.message || "").toLowerCase().includes("duplicate") || error.code === 409) {
            created.skipped++;
          } else {
            created.errors.push(`"${p.sku || p.name}": ${error.message}`);
          }
        }
      }

      return created;
    },
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setFile(null);
      setDetectedFormat(null);
    },
  });

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResults(null);
    setDetectedFormat(null);
    if (f) {
      try {
        const rawRows = await readRows(f);
        const { format } = detectFormat(rawRows);
        setDetectedFormat(format);
      } catch (err) {
        setDetectedFormat("error");
      }
    }
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
          <CardTitle className="text-lg">Bulk Product Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-stone-600 mb-3">
              Download the template, fill in your products, then upload to import in bulk.
              Your Etsy/Meta catalog CSV is also supported — it's auto-detected.
            </p>
            <Button onClick={downloadTemplate} variant="outline" className="w-full gap-2">
              <Download className="w-4 h-4" />
              Download CSV Template
            </Button>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-stone-700 mb-2">Upload CSV File</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
            />
            {file && (
              <div className="mt-2 text-xs text-stone-500">
                <p>Selected: {file.name}</p>
                {detectedFormat === "meta" && (
                  <p className="mt-1 text-emerald-700 font-medium">
                    ✓ Etsy/Meta catalog detected — will map id→SKU, title→Name, price→Sale Price, description→Notes
                  </p>
                )}
                {detectedFormat === "template" && (
                  <p className="mt-1 text-emerald-700 font-medium">✓ Standard template format detected</p>
                )}
                {detectedFormat === "unknown" && (
                  <p className="mt-1 text-amber-700 font-medium">⚠ Couldn't detect format — using template format</p>
                )}
                {detectedFormat === "error" && (
                  <p className="mt-1 text-rose-700 font-medium">⚠ Couldn't read file</p>
                )}
              </div>
            )}
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
            {results.skipped > 0 && (
              <div>↷ Skipped (duplicates): <span className="font-semibold">{results.skipped}</span></div>
            )}
            {results.errors.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold text-yellow-800 mb-2">Errors:</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
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