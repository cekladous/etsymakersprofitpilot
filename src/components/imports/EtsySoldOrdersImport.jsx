import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function EtsySoldOrdersImport({ open, onOpenChange, embedded = false }) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ orders }) => {
      const currentUser = await base44.auth.me();

      // Pre-fetch all existing orders and customers ONCE (same pattern as Monthly Statement)
      const [allExistingOrders, allExistingCustomers] = await Promise.all([
        base44.entities.EtsyOrder.filter({ owner_user_id: currentUser.id }),
        base44.entities.Customer.filter({ owner_user_id: currentUser.id }),
      ]);

      const orderMap = {};
      allExistingOrders.forEach(o => { orderMap[String(o.order_id).trim()] = o; });

      const customerByBuyerName = {};
      const customerByName = {};
      allExistingCustomers.forEach(c => {
        if (c.etsy_buyer_name) customerByBuyerName[c.etsy_buyer_name] = c;
        if (c.name) customerByName[c.name.toLowerCase()] = c;
      });

      const result = { created: 0, updated: 0, skipped: 0, customers_created: 0, customers_updated: 0 };

      // --- Customer upsert (dedup by etsy_buyer_name, then by name) ---
      const customersToCreate = [];
      const customersToUpdate = [];
      const seenBuyerKeys = new Set();

      for (const order of orders) {
        if (!order.customer?.name && !order.customer?.etsy_buyer_name) continue;

        const buyerKey = order.customer.etsy_buyer_name || order.customer.name?.toLowerCase();
        if (seenBuyerKeys.has(buyerKey)) continue;
        seenBuyerKeys.add(buyerKey);

        let match = null;
        if (order.customer.etsy_buyer_name) match = customerByBuyerName[order.customer.etsy_buyer_name];
        if (!match && order.customer.name) match = customerByName[order.customer.name.toLowerCase()];

        if (match) {
          const updateData = {};
          if (order.customer.name && order.customer.name !== match.name) updateData.name = order.customer.name;
          if (order.customer.etsy_buyer_name && !match.etsy_buyer_name) updateData.etsy_buyer_name = order.customer.etsy_buyer_name;
          if (order.customer.address && !match.address) updateData.address = order.customer.address;
          if (Object.keys(updateData).length > 0) customersToUpdate.push({ id: match.id, ...updateData });
          result.customers_updated++;
        } else {
          customersToCreate.push({ ...order.customer, owner_user_id: currentUser.id });
          result.customers_created++;
        }
      }

      if (customersToCreate.length > 0) {
        for (let i = 0; i < customersToCreate.length; i += 25) {
          await base44.entities.Customer.bulkCreate(customersToCreate.slice(i, i + 25));
          if (i + 25 < customersToCreate.length) await new Promise(r => setTimeout(r, 50));
        }
      }
      if (customersToUpdate.length > 0) {
        for (let i = 0; i < customersToUpdate.length; i += 10) {
          await base44.entities.Customer.bulkUpdate(customersToUpdate.slice(i, i + 10));
          if (i + 10 < customersToUpdate.length) await new Promise(r => setTimeout(r, 50));
        }
      }

      // --- Order upsert (dedup by order_id) ---
      const ordersToCreate = [];
      const ordersToUpdate = [];

      for (const order of orders) {
        if (!order.order_id) { result.skipped++; continue; }
        const orderIdKey = String(order.order_id).trim();
        const { customer, ...orderData } = order;
        const existing = orderMap[orderIdKey];

        if (existing) {
          ordersToUpdate.push({ id: existing.id, ...orderData });
          result.updated++;
        } else {
          ordersToCreate.push({ ...orderData, owner_user_id: currentUser.id, source: 'etsy_sold_orders' });
          result.created++;
        }
      }

      if (ordersToCreate.length > 0) {
        for (let i = 0; i < ordersToCreate.length; i += 25) {
          await base44.entities.EtsyOrder.bulkCreate(ordersToCreate.slice(i, i + 25));
          if (i + 25 < ordersToCreate.length) await new Promise(r => setTimeout(r, 50));
        }
      }
      if (ordersToUpdate.length > 0) {
        for (let i = 0; i < ordersToUpdate.length; i += 10) {
          await base44.entities.EtsyOrder.bulkUpdate(ordersToUpdate.slice(i, i + 10));
          if (i + 10 < ordersToUpdate.length) await new Promise(r => setTimeout(r, 50));
        }
      }

      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
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

        const orders = jsonData.map((row, idx) => {
            const normalized = normalizeRow(row);

            const shipping = parseMoney(normalized["Shipping"] || "");
            const fullName = getRowValue(normalized, "Full Name");
            const buyerUsername = getRowValue(normalized, "Buyer", "Buyer User ID");
            const firstName = getRowValue(normalized, "First Name");
            const lastName = getRowValue(normalized, "Last Name");
            const street1 = getRowValue(normalized, "Street 1");
            const street2 = getRowValue(normalized, "Street 2");
            const city = getRowValue(normalized, "Ship City");
            const state = getRowValue(normalized, "Ship State");
            const zip = getRowValue(normalized, "Ship Zipcode");
            const country = getRowValue(normalized, "Ship Country");

            const address = [street1, street2, city, state, zip, country]
              .filter(Boolean)
              .join(", ");

            return {
             sale_date: parseDate(getRowValue(normalized, "Sale Date", "Order Date")),
             order_id: String(getRowValue(normalized, "Order ID") || ""),
             buyer_username: buyerUsername,
             buyer_full_name: fullName,
             first_name: firstName,
             last_name: lastName,
             number_of_items: parseInt(getRowValue(normalized, "Number of Items") || "1"),
             sku: getRowValue(normalized, "SKU"),
             product_name: getRowValue(normalized, "Title", "Product", "Item Title"),
             coupon_code: getRowValue(normalized, "Coupon Code"),
             discount_amount: parseMoney(getRowValue(normalized, "Discount Amount")),
             shipping_discount: parseMoney(getRowValue(normalized, "Shipping Discount")),
             shipping_charged: shipping,
             order_value: parseMoney(getRowValue(normalized, "Order Value")),
        sales_tax: parseMoney(getRowValue(normalized, 'Sales Tax', 'Sales Tax Collected', 'Tax Collected', 'Tax', 'VAT')),
             order_total: parseMoney(getRowValue(normalized, "Order Total")),
             adjusted_order_total: parseMoney(getRowValue(normalized, "Adjusted Order Total")),
             card_processing_fees: parseMoney(getRowValue(normalized, "Card Processing Fees")),
             adjusted_card_processing_fees: parseMoney(getRowValue(normalized, "Adjusted Card Processing Fees")),
             order_net: parseMoney(getRowValue(normalized, "Order Net")),
             adjusted_net_order_amount: parseMoney(getRowValue(normalized, "Adjusted Net Order Amount")),
             payment_method: getRowValue(normalized, "Payment Method"),
             date_shipped: parseDate(getRowValue(normalized, "Date Shipped")),
             status: getRowValue(normalized, "Status") || "completed",
             currency: getRowValue(normalized, "Currency"),
             order_type: getRowValue(normalized, "Order Type"),
             payment_type: getRowValue(normalized, "Payment Type"),
             inperson_discount: parseMoney(getRowValue(normalized, "InPerson Discount")),
             inperson_location: getRowValue(normalized, "InPerson Location"),
             // Customer data for upsert — use buyer_username as stable key
             customer: {
               name: fullName || buyerUsername,
               etsy_buyer_name: buyerUsername || undefined,
               address: address || undefined,
             }
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
            {importResult.created > 0 && <p>✓ {importResult.created} new orders created</p>}
            <p>✓ {importResult.updated} existing orders updated</p>
            {importResult.customers_created > 0 && <p>✓ {importResult.customers_created} customers added</p>}
            {importResult.customers_updated > 0 && <p>✓ {importResult.customers_updated} customers updated</p>}
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