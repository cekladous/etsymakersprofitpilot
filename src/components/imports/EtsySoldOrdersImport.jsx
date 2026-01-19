import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function EtsySoldOrdersImport({ open, onOpenChange, embedded = false }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ orders }) => {
      const result = { created: 0, updated: 0, skipped: 0 };
      
      for (const order of orders) {
        const existing = await base44.entities.EtsyOrder.filter({ order_id: order.order_id });
        
        if (existing.length > 0) {
           // Merge with existing data - keep financial data from statement, add product details
           await base44.entities.EtsyOrder.update(existing[0].id, {
             ...existing[0],
             sale_date: order.sale_date || existing[0].sale_date,
             buyer_full_name: order.buyer_full_name || existing[0].buyer_full_name,
             buyer_username: order.buyer_username || existing[0].buyer_username,
             number_of_items: order.number_of_items || existing[0].number_of_items,
             // Don't override financial data from statement
           });
           result.updated++;
         } else {
           // Create new order with product data only (financial data comes from statement)
           await base44.entities.EtsyOrder.create(order);
           result.created++;
         }
        
        // Small delay to prevent rate limiting
        if ((result.created + result.updated) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      setImporting(false);
      setPreview(null);
      setPendingData(null);
    },
    onError: (error) => {
      setImportResult({ error: error.message });
      setImporting(false);
    },
  });

  const parseDate = (val) => {
    if (!val) return null;
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  };

  const parseMoney = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    const str = String(v ?? "").trim().replace(/[$,]/g, "");
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
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
          setImportResult({ error: "File is empty" });
          setImporting(false);
          return;
        }

        const orders = jsonData.map(row => ({
          sale_date: parseDate(row["Sale Date"] || row["Order Date"]),
          order_id: String(row["Order ID"] || ""),
          buyer_username: row["Buyer"] || row["Buyer User ID"] || "",
          buyer_full_name: row["Full Name"] || "",
          number_of_items: parseInt(row["Quantity"] || row["Number of Items"] || "1"),
          // Financial fields left empty - will be filled by Monthly Statement
          order_value: 0,
          shipping_charged: 0,
          sales_tax: 0,
          order_total: 0,
          order_net: 0,
          status: "completed",
        })).filter(o => o.order_id);

        setPreview({ count: orders.length });
        setPendingData({ orders });
        setImporting(false);
      } catch (error) {
        setImportResult({ error: `Failed to parse file: ${error.message}` });
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

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {!importing && !preview && !importResult && (
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
          variant="outline"
          size="lg"
        >
          <Upload className="w-5 h-5 mr-2" />
          Select Sold Orders CSV
        </Button>
      )}

      {importing && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-stone-600">Processing orders...</p>
        </div>
      )}

      {preview && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="bg-stone-50 rounded-lg p-4">
              <p className="text-sm font-medium text-stone-900">Ready to Import</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{preview.count}</p>
              <p className="text-xs text-stone-500 mt-1">orders found</p>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => { setPreview(null); setPendingData(null); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmImport} 
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
              >
                Confirm Import
              </Button>
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
            <p>✓ {importResult.created} new orders created</p>
            <p>✓ {importResult.updated} existing orders updated</p>
          </div>
          <Button 
            onClick={handleClose} 
            variant="outline" 
            size="sm" 
            className="mt-4 w-full"
          >
            Done
          </Button>
        </div>
      )}

      {importResult?.error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <p className="font-semibold text-rose-900">Import Failed</p>
          </div>
          <p className="text-sm text-rose-800">{importResult.error}</p>
          <Button 
            onClick={handleClose} 
            variant="outline" 
            size="sm" 
            className="mt-4 w-full"
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
}