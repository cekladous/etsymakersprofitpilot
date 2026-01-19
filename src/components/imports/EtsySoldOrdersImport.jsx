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
      // Use backend function to update orders with product details
      const { data } = await base44.functions.invoke('updateOrdersWithSoldData', { orders });
      return data;
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

  const normalizeRow = (row) => {
    const normalized = {};
    Object.keys(row).forEach(key => {
      const trimmedKey = key.trim();
      normalized[trimmedKey] = row[key];
    });
    return normalized;
  };

  const getRowValue = (row, ...keyOptions) => {
    for (const key of keyOptions) {
      const val = row[key];
      if (val !== null && val !== undefined && val !== "") {
        return val;
      }
    }
    return "";
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

        const orders = jsonData.map(row => {
          const normalized = normalizeRow(row);
          return {
           sale_date: parseDate(getRowValue(normalized, "Sale Date", "Order Date")),
           order_id: String(getRowValue(normalized, "Order ID") || ""),
           buyer_username: getRowValue(normalized, "Buyer", "Buyer User ID"),
           buyer_full_name: getRowValue(normalized, "Full Name"),
           number_of_items: parseInt(getRowValue(normalized, "Quantity", "Number of Items") || "1"),
           sku: getRowValue(normalized, "SKU", "Sku"),
           product_name: getRowValue(normalized, "Title", "Product", "Item Title"),
           coupon_code: getRowValue(normalized, "Coupon Code", "Coupon"),
           // Capture financial fields from Sold Orders CSV
           order_value: parseMoney(getRowValue(normalized, "Order Value")),
           shipping_charged: parseMoney(getRowValue(normalized, "Shipping")),
           sales_tax: parseMoney(getRowValue(normalized, "Sales Tax")),
           order_total: parseMoney(getRowValue(normalized, "Order Total")),
           order_net: parseMoney(getRowValue(normalized, "Order Net")),
           discount_amount: parseMoney(getRowValue(normalized, "Discount Amount")),
           card_processing_fees: parseMoney(getRowValue(normalized, "Card Processing Fees")),
           status: "completed",
           };
           }).filter(o => o.order_id);

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