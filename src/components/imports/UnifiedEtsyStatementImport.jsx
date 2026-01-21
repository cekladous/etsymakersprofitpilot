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

// Generate stable line_uid from transaction data
const generateLineUID = (date, type, amount, description, orderId, month) => {
  const str = `${date}|${type}|${amount}|${description}|${orderId || ''}|${month}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${month}_${Math.abs(hash).toString(36)}`;
};

// Parse helpers
const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return format(val, 'yyyy-MM-dd');
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return format(date, 'yyyy-MM-dd');
  }
  const str = String(val).trim();
  const ddmmmyy = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (ddmmmyy) {
    const [, day, monthStr, year] = ddmmmyy;
    const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    const month = months[monthStr.toLowerCase()];
    if (month) {
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      return `${fullYear}-${month}-${day.padStart(2, "0")}`;
    }
  }
  const date = new Date(str);
  if (!isNaN(date.getTime())) return format(date, 'yyyy-MM-dd');
  return null;
};

const parseMoney = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const str = String(v ?? "").trim();
  const isNegative = str.includes("(") && str.includes(")");
  const cleaned = str.replace(/[$(),\s]/g, "");
  const num = parseFloat(cleaned);
  return (isNaN(num) ? 0 : num) * (isNegative ? -1 : 1);
};

const parseIntSafe = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const num = parseInt(String(v).trim());
  return isNaN(num) ? 0 : num;
};

// Extract order ID from text
const extractOrderId = (text) => {
  if (!text) return null;
  const patterns = [
    /order\s*#?\s*(\d+)/i,
    /order\s+id[:\s]+(\d+)/i,
    /\b(\d{10,})\b/,
  ];
  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Comprehensive classification logic for Etsy statement lines (optimized)
const classifyStatementLine = (row) => {
  const type = row["Type"] || "";
  const title = row["Title"] || "";
  const info = row["Info"] || row["Description"] || "";
  const taxDetails = row["Tax Details"] || "";
  
  // Quick lowercase check - only lowercase once
  const typeL = type.toLowerCase();
  const titleL = title.toLowerCase();
  const infoL = info.toLowerCase();
  const taxDetailsL = taxDetails.toLowerCase();
  
  const amount = parseMoney(row["Amount"]);
  
  // Extract order ID once
  const orderId = extractOrderId(titleL) || extractOrderId(infoL) || extractOrderId(taxDetailsL);
  
  // Fast path checks - most common patterns first
  if (titleL.includes('deposit') || titleL.includes('payout') || titleL.includes('transfer')) {
    return { category: 'deposit', section: 'deposits', fee_type: null, order_id: null };
  }
  
  if (titleL.includes('refund') || titleL.includes('chargeback')) {
    return { category: 'refund', section: 'refunds', fee_type: null, order_id: orderId };
  }
  
  if (titleL.includes('listing') && titleL.includes('fee')) {
    return { category: 'fee', section: 'fees', fee_type: 'listing', order_id: orderId };
  }
  
  if (titleL.includes('transaction') && titleL.includes('fee')) {
    return { category: 'fee', section: 'fees', fee_type: 'transaction', order_id: orderId };
  }
  
  if (titleL.includes('processing') || titleL.includes('payment processing')) {
    return { category: 'fee', section: 'fees', fee_type: 'processing', order_id: orderId };
  }
  
  if (titleL.includes('etsy ads') || titleL.includes('etsy ad')) {
    return { category: 'fee', section: 'ads', fee_type: 'etsy_ads', order_id: orderId };
  }
  
  if (titleL.includes('offsite ads') || titleL.includes('offsite ad')) {
    return { category: 'fee', section: 'ads', fee_type: 'offsite_ads', order_id: orderId };
  }
  
  if (titleL.includes('shipping label')) {
    return { category: 'fee', section: 'shipping', fee_type: 'shipping_label', order_id: orderId };
  }
  
  if (titleL.includes('postage')) {
    return { category: 'fee', section: 'shipping', fee_type: 'other_postage', order_id: orderId };
  }
  
  if (titleL.includes('share') && titleL.includes('save')) {
    return { category: 'fee', section: 'fees', fee_type: 'share_save_credit', order_id: orderId };
  }
  
  if (titleL.includes('regulatory operating fee')) {
    return { category: 'fee', section: 'fees', fee_type: 'other_fee', order_id: orderId };
  }
  
  if (titleL.includes('etsy plus') && titleL.includes('subscription')) {
    return { category: 'fee', section: 'fees', fee_type: 'etsy_plus_subscription', order_id: null };
  }
  
  if ((titleL.includes('credits') && titleL.includes('plus')) || (titleL.includes('etsy plus') && titleL.includes('credit'))) {
    // Check if it's ads credit or listing credit
    if (titleL.includes('ads') || infoL.includes('ads')) {
      return { category: 'fee', section: 'fees', fee_type: 'etsy_plus_ads_credit', order_id: null };
    }
    // Default to listing credit for general "Credits (Plus)"
    return { category: 'fee', section: 'fees', fee_type: 'etsy_plus_listing_credit', order_id: null };
  }
  
  if (titleL.includes('credit for etsy ads') && amount < 0) {
    return { category: 'fee', section: 'fees', fee_type: 'etsy_plus_ads_credit', order_id: null };
  }
  
  if (typeL.includes('sale') && amount > 0) {
    return { category: 'sale', section: 'orders', fee_type: null, order_id: orderId };
  }
  
  if (taxDetailsL) {
    return { category: 'tax', section: 'taxes', fee_type: null, order_id: orderId };
  }
  
  if (titleL.includes('fee')) {
    return { category: 'fee', section: 'fees', fee_type: 'other_fee', order_id: orderId };
  }
  
  return { category: 'unmatched', section: 'unknown', fee_type: null, order_id: orderId };
};

export default function UnifiedEtsyStatementImport({ open, onOpenChange, embedded = false }) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ statementMonth, dateRangeStart, dateRangeEnd, fileName, fileHash, parsedData }) => {
      const { orders, fees, deposits, refunds, taxes, unmatchedLines } = parsedData;
      
      // Helper to batch operations using bulk creates for speed
       const batchProcess = async (items, batchSize, entityName) => {
         for (let i = 0; i < items.length; i += batchSize) {
           const batch = items.slice(i, i + batchSize);
           await base44.entities[entityName].bulkCreate(batch);
           // Small delay between batches only
           await new Promise(resolve => setTimeout(resolve, 200));
         }
       };
      
      // Get owner_user_id from authenticated user
      const currentUser = await base44.auth.me();
      
      // Get all existing statement lines to check for duplicates (only for current user)
      const allExistingLines = await base44.entities.EtsyStatementLine.filter({ owner_user_id: currentUser.id });
      const existingLineUIDs = new Set(allExistingLines.map(line => line.line_uid));
      
      // Get all existing fees to prevent duplicates across imports
      const allExistingFees = await base44.entities.Fee.filter({ owner_user_id: currentUser.id });
      const existingFeeKeys = new Set(
        allExistingFees.map(f => `${f.transaction_date}|${f.order_id || ''}|${f.fee_type}|${f.amount}`)
      );
      
      // Filter out rows that already exist
      const newOrders = orders.filter(o => !existingLineUIDs.has(o._rawLine.line_uid));
      // For fees, only check if the Fee entity exists (not statement lines, which are audit trail)
      const newFees = fees.filter(f => {
        const feeKey = `${f.transaction_date}|${f.order_id || ''}|${f.fee_type}|${f.amount}`;
        return !existingFeeKeys.has(feeKey);
      });
      const newDeposits = deposits.filter(d => !existingLineUIDs.has(d._rawLine.line_uid));
      const newRefunds = refunds.filter(r => !existingLineUIDs.has(r._rawLine.line_uid));
      
      // Check if this statement month was already imported (only for current user)
      const existingImports = await base44.entities.EtsyStatementImport.filter({ 
        statement_month: statementMonth,
        owner_user_id: currentUser.id
      });
      let importRecord;
      
      // Create new import record
      importRecord = await base44.entities.EtsyStatementImport.create({
        owner_user_id: currentUser.id,
        import_id: `import_${Date.now()}`,
        statement_month: statementMonth,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        file_name: fileName,
        file_hash: fileHash,
        imported_at: new Date().toISOString(),
        status: 'success',
      });

      const skippedFees = fees.length - newFees.length;
      
      const result = {
        orders: { created: 0, updated: 0, skipped: orders.length - newOrders.length },
        fees: { created: 0, skipped: skippedFees },
        deposits: { created: 0, skipped: deposits.length - newDeposits.length },
        refunds: { created: 0 },
        taxes: { created: 0 },
        unmatched: { count: 0 }
      };
      
      // Show error if fees are being duplicated
      if (skippedFees > 0) {
        console.warn(`⚠️ Skipped ${skippedFees} duplicate fee(s)`);
      }

      // Import only new orders (upsert by order_id)
      // Build a map of order_id -> EtsyOrder entity ID for later linking
      const orderIdToEntityId = {};
      for (const order of newOrders) {
        const existing = await base44.entities.EtsyOrder.filter({ order_id: order.order_id, owner_user_id: currentUser.id });
        if (existing.length > 0) {
          await base44.entities.EtsyOrder.update(existing[0].id, order);
          orderIdToEntityId[order.order_id] = existing[0].id;
          result.orders.updated++;
        } else {
          const created = await base44.entities.EtsyOrder.create({ ...order, owner_user_id: currentUser.id });
          orderIdToEntityId[order.order_id] = created.id;
          result.orders.created++;
        }
      }

      // Import only new fees (bulk create)
      if (newFees.length > 0) {
        const feesToCreate = newFees.map(fee => ({ 
          ...fee, 
          owner_user_id: currentUser.id, 
          import_id: importRecord.id 
        }));
        await batchProcess(feesToCreate, 50, 'Fee');
        result.fees.created = newFees.length;
      }

      // Aggregate fees into OrderFee records for each order (only new fees)
      const orderFeeMap = {};
      newFees.forEach(fee => {
        if (fee.order_id) {
          if (!orderFeeMap[fee.order_id]) {
            orderFeeMap[fee.order_id] = {
              order_id: fee.order_id,
              listing_fees: 0,
              transaction_fees: 0,
              processing_fees: 0,
              share_save_refunds_credits: 0,
              other_fees: 0,
              etsy_ads: 0,
              offsite_ads_fees: 0,
              etsy_shipping: 0,
              other_postage_costs: 0,
              total_fees: 0
            };
          }
          
          const amount = Math.abs(fee.amount);
          if (fee.fee_type === 'listing') orderFeeMap[fee.order_id].listing_fees += amount;
          else if (fee.fee_type === 'transaction') orderFeeMap[fee.order_id].transaction_fees += amount;
          else if (fee.fee_type === 'processing') orderFeeMap[fee.order_id].processing_fees += amount;
          else if (fee.fee_type === 'share_save_credit') orderFeeMap[fee.order_id].share_save_refunds_credits += amount;
          else if (fee.fee_type === 'etsy_ads') orderFeeMap[fee.order_id].etsy_ads += amount;
          else if (fee.fee_type === 'offsite_ads') orderFeeMap[fee.order_id].offsite_ads_fees += amount;
          else if (fee.fee_type === 'shipping_label') orderFeeMap[fee.order_id].etsy_shipping += amount;
          else if (fee.fee_type === 'other_postage') orderFeeMap[fee.order_id].other_postage_costs += amount;
          else orderFeeMap[fee.order_id].other_fees += amount;
          
          orderFeeMap[fee.order_id].total_fees += amount;
        }
      });

      // Create/update OrderFee records
      const orderFeeRecords = Object.values(orderFeeMap);
      for (const orderFee of orderFeeRecords) {
        const existing = await base44.entities.OrderFee.filter({ order_id: orderFee.order_id, owner_user_id: currentUser.id });
        if (existing.length > 0) {
          await base44.entities.OrderFee.update(existing[0].id, orderFee);
        } else {
          await base44.entities.OrderFee.create({ ...orderFee, owner_user_id: currentUser.id });
        }
      }

      // Import only new deposits as transfers (bulk create)
      if (newDeposits.length > 0) {
        const depositsToCreate = newDeposits.map(deposit => ({ 
          ...deposit, 
          owner_user_id: currentUser.id 
        }));
        await batchProcess(depositsToCreate, 50, 'Transfer');
        result.deposits.created = newDeposits.length;
      }

      // Apply refunds to orders
      const refundsByOrderId = {};
      newRefunds.forEach(refund => {
        if (refund.orderId) {
          refundsByOrderId[refund.orderId] = (refundsByOrderId[refund.orderId] || 0) + refund.amount;
        }
      });

      // Update orders with refund amounts
      for (const [orderId, refundAmount] of Object.entries(refundsByOrderId)) {
        const order = await base44.entities.EtsyOrder.filter({ order_id: orderId, owner_user_id: currentUser.id });
        if (order.length > 0) {
          const currentRefund = order[0].refund_amount || 0;
          await base44.entities.EtsyOrder.update(order[0].id, {
            refund_amount: currentRefund + refundAmount
          });
        }
      }

      result.refunds.created = newRefunds.length;
      result.taxes.created = taxes.length;
      result.unmatched.count = unmatchedLines.length;

      // Save only new statement lines (including refunds) with source_etsy_order_id links (bulk create)
      const newLines = [
        ...newOrders.map(o => ({ ...o._rawLine, source_etsy_order_id: orderIdToEntityId[o.order_id] || null })), 
        ...newFees.map(f => ({ ...f._rawLine, source_etsy_order_id: orderIdToEntityId[f.order_id] || null })), 
        ...newDeposits.map(d => d._rawLine),
        ...newRefunds.map(r => ({ ...r._rawLine, source_etsy_order_id: orderIdToEntityId[r.orderId] || null }))
      ];
      if (newLines.length > 0) {
        const linesToCreate = newLines.map(line => ({
          owner_user_id: currentUser.id,
          import_id: importRecord.id,
          ...line
        }));
        await batchProcess(linesToCreate, 50, 'EtsyStatementLine');
      }

      // Update import counts
      await base44.entities.EtsyStatementImport.update(importRecord.id, {
        orders_count: result.orders.created + result.orders.updated,
        fees_count: result.fees.created,
        deposits_count: result.deposits.created,
        refunds_count: result.refunds.created,
        taxes_count: result.taxes.created,
        unmatched_count: result.unmatched.count,
        reconciliation_status: 'success'
      });

      return result;
    },
    onSuccess: async (result) => {
      // Track import usage for Free users
      try {
        const currentUser = await base44.auth.me();
        const subscriptions = await base44.entities.Subscription.filter({
          owner_user_id: currentUser.id
        });
        const subscription = subscriptions[0];

        if (subscription?.plan_id === 'free') {
          await base44.entities.Subscription.update(subscription.id, {
            imports_used_this_month: (subscription.imports_used_this_month || 0) + 1
          });
        }
      } catch (err) {
        console.warn('Failed to track import usage:', err);
      }

      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-lines"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      setImporting(false);
      setPreview(null);
      setPendingData(null);
    },
    onError: (error) => {
      setImportResult({ error: error.message });
      setImporting(false);
    },
  });

  // Generate simple hash from file content
  const generateFileHash = (data) => {
    let hash = 0;
    const str = JSON.stringify(data);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }
    
    console.log("File selected:", file.name, file.type);
    setImporting(true);
    setImportResult(null);
    setDuplicateWarning(null);

    const reader = new FileReader();
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      setImportResult({ error: "Failed to read file" });
      setImporting(false);
    };
    reader.onload = async (e) => {
      try {
         console.log("File loaded, parsing...");
         const XLSX = await import("xlsx");
         const data = new Uint8Array(e.target.result);
         const workbook = XLSX.read(data, { type: "array" });
         const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
         const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
        console.log("Parsed rows:", jsonData.length);

        if (jsonData.length === 0) {
          setImportResult({ error: "File is empty" });
          setImporting(false);
          return;
        }

        // Parse statement
        console.log("Parsing statement data...");
        const parsed = parseEtsyStatement(jsonData, file.name);
        console.log("Parsed:", {
          orders: parsed.orders.length,
          fees: parsed.fees.length,
          deposits: parsed.deposits.length,
          unmatched: parsed.unmatchedLines.length
        });
        const fileHash = generateFileHash(jsonData);
        
        // Check for duplicate file (only for current user)
        const existingImportsByHash = await base44.entities.EtsyStatementImport.filter({ 
          file_hash: fileHash,
          owner_user_id: user.id
        });
        if (existingImportsByHash.length > 0) {
          const existing = existingImportsByHash[0];
          setDuplicateWarning({
            type: 'duplicate_file',
            existingImport: existing,
            newData: {
              statementMonth: parsed.statementMonth,
              dateRangeStart: parsed.dateRangeStart,
              dateRangeEnd: parsed.dateRangeEnd,
              fileName: file.name,
              fileHash,
              parsedData: parsed
            },
            preview: {
              orders: parsed.orders.length,
              fees: parsed.fees.length,
              deposits: parsed.deposits.length,
              refunds: parsed.refunds.length,
              taxes: parsed.taxes.length,
              unmatched: parsed.unmatchedLines.length,
              statementMonth: parsed.statementMonth,
              dateRange: `${parsed.dateRangeStart} to ${parsed.dateRangeEnd}`
            }
          });
          setImporting(false);
          return;
        }
        
        // Check for existing import of the same month (regardless of file hash)
        const existingImportsByMonth = await base44.entities.EtsyStatementImport.filter({
          statement_month: parsed.statementMonth,
          owner_user_id: user.id,
          status: { $ne: 'replaced' } // Exclude already-replaced imports
        });
        if (existingImportsByMonth.length > 0) {
          const existing = existingImportsByMonth[0];
          const newRecordCount = parsed.orders.length + parsed.fees.length + parsed.deposits.length;
          setDuplicateWarning({
            type: 'duplicate_month',
            existingImport: existing,
            newData: {
              statementMonth: parsed.statementMonth,
              dateRangeStart: parsed.dateRangeStart,
              dateRangeEnd: parsed.dateRangeEnd,
              fileName: file.name,
              fileHash,
              parsedData: parsed
            },
            preview: {
              orders: parsed.orders.length,
              fees: parsed.fees.length,
              deposits: parsed.deposits.length,
              refunds: parsed.refunds.length,
              taxes: parsed.taxes.length,
              unmatched: parsed.unmatchedLines.length,
              statementMonth: parsed.statementMonth,
              dateRange: `${parsed.dateRangeStart} to ${parsed.dateRangeEnd}`,
              newRecordCount,
              previousImportDate: existing.imported_at
            }
          });
          setImporting(false);
          return;
        }
        
        setPreview({
          orders: parsed.orders.length,
          fees: parsed.fees.length,
          deposits: parsed.deposits.length,
          refunds: parsed.refunds.length,
          taxes: parsed.taxes.length,
          unmatched: parsed.unmatchedLines.length,
          statementMonth: parsed.statementMonth,
          dateRange: `${parsed.dateRangeStart} to ${parsed.dateRangeEnd}`
        });
        
        setPendingData({
          statementMonth: parsed.statementMonth,
          dateRangeStart: parsed.dateRangeStart,
          dateRangeEnd: parsed.dateRangeEnd,
          fileName: file.name,
          fileHash,
          parsedData: parsed
        });
        
        setImporting(false);
      } catch (error) {
        console.error("Parse error:", error);
        setImportResult({ error: `Failed to parse file: ${error.message}` });
        setImporting(false);
      }
    };
    
    console.log("Starting file read...");
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const parseEtsyStatement = (jsonData, fileName) => {
    const orders = [];
    const fees = [];
    const deposits = [];
    const refunds = [];
    const taxes = [];
    const unmatchedLines = [];

    let minDate = null;
    let maxDate = null;

    // Normalize row keys by trimming whitespace
    const normalizeRow = (row) => {
      const normalized = {};
      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim();
        const value = row[key];
        normalized[trimmedKey] = value;
      });
      return normalized;
    };

    // Helper to safely get a value from a row, trying multiple key variations
    const getRowValue = (row, ...keyOptions) => {
      for (const key of keyOptions) {
        const val = row[key];
        if (val !== null && val !== undefined && val !== "") {
          return val;
        }
      }
      return "";
    };

    // Pre-process: classify all rows once and build fee lookup
    const classifiedRows = jsonData.map((row, idx) => ({
      row: normalizeRow(row),
      idx,
      classification: classifyStatementLine(normalizeRow(row))
    }));
    
    const feesByOrderId = {};
    classifiedRows.forEach(({ row, classification }) => {
      if (classification.category === 'fee' && classification.order_id) {
        if (!feesByOrderId[classification.order_id]) {
          feesByOrderId[classification.order_id] = [];
        }
        feesByOrderId[classification.order_id].push(row);
      }
    });

    classifiedRows.forEach(({ row, idx, classification }) => {
      const dateVal = row["Date"] || row["Order Date"] || row["Sale Date"];
      const transactionDate = parseDate(dateVal);
      if (!transactionDate) {
        unmatchedLines.push({
          line_uid: `unmatched_${idx}`,
          transaction_date: null,
          type: row["Type"] || "Unknown",
          description: row["Title"] || row["Description"] || "",
          amount: parseMoney(row["Amount"] || row["Order Total"]),
          category: 'unmatched',
          section: 'unknown',
          raw_json: JSON.stringify(row),
          matched: false,
          match_error: "Missing or invalid date"
        });
        return;
      }

      if (!minDate || transactionDate < minDate) minDate = transactionDate;
      if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;

      const type = row["Type"] || "";
      const title = row["Title"] || "";
      const info = row["Info"] || row["Description"] || "";
      const amount = parseMoney(row["Amount"]);
      const feesTaxes = parseMoney(row["Fees & Taxes"]);
      const net = parseMoney(row["Net"]);
      const statementMonth = transactionDate.substring(0, 7);
      const lineUID = generateLineUID(transactionDate, type, amount, title, classification.order_id || "", statementMonth);

      // Create raw line for this transaction
      const rawLine = {
        line_uid: lineUID,
        transaction_date: transactionDate,
        type,
        description: title,
        amount,
        order_id: classification.order_id,
        fee_type: classification.fee_type,
        category: classification.category,
        section: classification.section,
        raw_json: JSON.stringify(row),
        matched: classification.category !== 'unmatched'
      };

      // A) DEPOSITS
          if (classification.category === 'deposit') {
            // Extract amount from description if amount column is 0 or empty
            let depositAmount = Math.abs(amount);
            if (!depositAmount || depositAmount === 0) {
              const amountMatch = title.match(/\$[\d,]+\.?\d*/);
              if (amountMatch) {
                depositAmount = parseMoney(amountMatch[0]);
              }
            }

            deposits.push({
              date: transactionDate,
              type: "etsy_deposit",
              amount: Math.abs(depositAmount),
              notes: `${title} - ${info}`,
              _rawLine: rawLine
            });
          }
          // B) ORDERS/SALES
           else if (classification.category === 'sale' && classification.order_id) {
             // Calculate total fees AND taxes for this order from the fees we found
             const orderFees = feesByOrderId[classification.order_id] || [];
             const orderTaxes = classifiedRows.filter(({ row: r, classification: c }) => 
               c.category === 'tax' && c.order_id === classification.order_id
             );

             const totalOrderFees = orderFees.reduce((sum, f) => {
               const feeAmount = parseMoney(f["Fees & Taxes"]);
               return sum + Math.abs(feeAmount || 0);
             }, 0);

             const totalTaxes = orderTaxes.reduce((sum, { row: r }) => {
               const taxAmount = parseMoney(r["Amount"] || r["Fees & Taxes"]);
               return sum + Math.abs(taxAmount || 0);
             }, 0);

            // Parse values from CSV - use safe getter for all fields
            let orderValue = parseMoney(getRowValue(row, "Order Value", "Item(s) price", "Item Total"));
            let shippingCharged = parseMoney(getRowValue(row, "Shipping", "Shipping price", "Shipping Charged", "Shipping Amount", "Shipping Cost"));
            let salesTax = parseMoney(getRowValue(row, "Sales Tax", "Tax paid by buyer"));
            const orderTotal = parseMoney(getRowValue(row, "Order Total", "Total")) || amount;

        // `orderValue` = Item(s) price from CSV. Only use if explicitly provided.
        // Do not derive from other fields to avoid double-counting deductions.

        // Calculate net payout correctly: order_total - total_fees - taxes
        // This equals Etsy's "Order earnings" = what buyer paid - (all fees & credits & tax)
        const calculatedNetPayout = orderTotal - totalOrderFees - totalTaxes;

        orders.push({
          sale_date: transactionDate,
          order_id: classification.order_id,
          buyer_username: row["Buyer User ID"] || row["Buyer"] || "",
          buyer_full_name: row["Full Name"] || "",
          number_of_items: parseIntSafe(row["Number of Items"] || row["Quantity"]),
          payment_method: row["Payment Method"] || "",
          order_value: orderValue,
          shipping_charged: shippingCharged,
          discount_amount: parseMoney(row["Discount Amount"] || row["Coupon"]),
          sales_tax: 0, // Sales tax is collected by Etsy and included in total fees deductions
          order_total: orderTotal,
          card_processing_fees: parseMoney(row["Card Processing Fees"]),
          order_net: calculatedNetPayout,
          status: row["Status"] || "completed",
          total_fees: totalOrderFees + totalTaxes,
          _rawLine: rawLine
        });
      }
      // C) REFUNDS - Track refunds to apply to orders
      else if (classification.category === 'refund') {
        refunds.push({
          transactionDate,
          orderId: classification.order_id,
          amount: Math.abs(amount), // Always positive amount
          description: title,
          _rawLine: rawLine
        });
      }
      // D) FEES (listing, transaction, processing, etc)
      // E) ADS (etsy_ads, offsite_ads)
      // F) SHIPPING (shipping_label, other_postage)
      else if (classification.category === 'fee') {
        fees.push({
          line_uid: lineUID,
          order_id: classification.order_id,
          transaction_date: transactionDate,
          fee_type: classification.fee_type,
          amount: feesTaxes || amount,
          description: title || info,
          _rawLine: rawLine
        });
      }
      // G) TAXES
      else if (classification.category === 'tax') {
        taxes.push({
          transactionDate,
          orderId: classification.order_id,
          amount: amount,
          taxDetails: row["Tax Details"] || ""
        });
      }
      // UNMATCHED
      else {
        unmatchedLines.push({
          ...rawLine,
          match_error: `Unknown pattern: Type="${type}", Title="${title}"`
        });
      }
    });

    const statementMonth = minDate ? minDate.substring(0, 7) : format(new Date(), 'yyyy-MM');

    return {
      orders,
      fees,
      deposits,
      refunds,
      taxes,
      unmatchedLines,
      statementMonth,
      dateRangeStart: minDate || format(new Date(), 'yyyy-MM-dd'),
      dateRangeEnd: maxDate || format(new Date(), 'yyyy-MM-dd')
    };
  };

  const confirmImport = () => {
    if (pendingData) {
      setImporting(true);
      setPreview(null);
      importMutation.mutate(pendingData);
    }
  };

  const confirmDuplicateImport = async () => {
    if (duplicateWarning?.newData) {
      setImporting(true);
      
      // If replacing an existing month, mark old import as 'replaced'
      if (duplicateWarning.type === 'duplicate_month') {
        try {
          await base44.entities.EtsyStatementImport.update(duplicateWarning.existingImport.id, {
            status: 'replaced',
            reconciliation_notes: `Replaced by new import on ${format(new Date(), 'MMM d, yyyy HH:mm')}`
          });
        } catch (err) {
          console.warn('Failed to mark old import as replaced:', err);
        }
      }
      
      setDuplicateWarning(null);
      importMutation.mutate(duplicateWarning.newData);
    }
  };

  const cancelDuplicate = () => {
    setDuplicateWarning(null);
  };

  const handleClose = () => {
    setImportResult(null);
    setPreview(null);
    setPendingData(null);
    setDuplicateWarning(null);
    if (!embedded) onOpenChange(false);
  };

  if (embedded) {
    return (
      <div className="space-y-4 py-4">
        <DialogHeader>
          <DialogTitle>Import Etsy Monthly Statement</DialogTitle>
          <DialogDescription>
            Upload your <strong>Etsy Monthly Statement CSV</strong> (not PDF). Go to Etsy → Finances → Payment Account → Download CSV.
            This will automatically populate Orders, Fees, Ads, Shipping Labels, and Deposits throughout the entire app.
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

          {duplicateWarning && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">
                    {duplicateWarning.type === 'duplicate_month' ? 'Replace Existing Statement?' : 'Duplicate File Detected'}
                  </p>
                  {duplicateWarning.type === 'duplicate_month' && (
                    <div className="text-sm text-amber-800 mt-2 space-y-1">
                      <p>Statement for <strong>{duplicateWarning.preview.statementMonth}</strong> was previously imported on {format(new Date(duplicateWarning.preview.previousImportDate), 'MMM d, yyyy')}</p>
                      <p className="mt-2"><strong>{duplicateWarning.preview.newRecordCount}</strong> new records will be imported from this file</p>
                    </div>
                  )}
                  {duplicateWarning.type === 'duplicate_file' && (
                    <p className="text-sm text-amber-800 mt-1">
                      This file was previously imported on {format(new Date(duplicateWarning.existingImport.imported_at), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={cancelDuplicate} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={confirmDuplicateImport} className="bg-amber-600 hover:bg-amber-700 flex-1">
                  {duplicateWarning.type === 'duplicate_month' ? 'Replace & Import' : 'Re-import Anyway'}
                </Button>
              </div>
            </div>
          )}

          {!importing && !preview && !importResult && !duplicateWarning && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              variant="outline"
              size="lg"
            >
              <Upload className="w-5 h-5 mr-2" />
              Select Etsy Statement File
            </Button>
          )}

          {importing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Analyzing statement...</p>
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
                  <p className="text-sm font-medium text-stone-900">Statement Period</p>
                  <p className="text-lg font-semibold text-emerald-600">{preview.statementMonth}</p>
                  <p className="text-xs text-stone-500">{preview.dateRange}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Orders</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.orders}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Fee Lines</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.fees}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Deposits</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.deposits}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Refunds</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.refunds}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Tax Lines</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.taxes}</p>
                  </div>
                  <div className={`border rounded-lg p-3 ${preview.unmatched > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
                    <p className="text-xs text-stone-500">Unmatched</p>
                    <p className={`text-2xl font-bold ${preview.unmatched > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
                      {preview.unmatched}
                    </p>
                  </div>
                </div>

                {preview.unmatched > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      ⚠ {preview.unmatched} rows need review after import
                    </p>
                  </div>
                )}
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
                <p>✓ Orders: {importResult.orders.created} created, {importResult.orders.updated} updated</p>
                <p>✓ Fees: {importResult.fees.created} imported</p>
                <p>✓ Deposits: {importResult.deposits.created} tracked</p>
                {importResult.unmatched.count > 0 && (
                  <p className="text-amber-700">⚠ {importResult.unmatched.count} unmatched rows (review needed)</p>
                )}
              </div>
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
          <DialogTitle>Import Etsy Monthly Statement</DialogTitle>
          <DialogDescription>
            Upload your <strong>Etsy Monthly Statement CSV</strong> (not PDF). Go to Etsy → Finances → Payment Account → Download CSV.
            This will automatically populate Orders, Fees, Ads, Shipping Labels, and Deposits throughout the entire app.
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
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              variant="outline"
              size="lg"
            >
              <Upload className="w-5 h-5 mr-2" />
              Select Etsy Statement File
            </Button>
          )}

          {importing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Analyzing statement...</p>
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
                  <p className="text-sm font-medium text-stone-900">Statement Period</p>
                  <p className="text-lg font-semibold text-emerald-600">{preview.statementMonth}</p>
                  <p className="text-xs text-stone-500">{preview.dateRange}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Orders</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.orders}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Fee Lines</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.fees}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Deposits</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.deposits}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Refunds</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.refunds}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-stone-500">Tax Lines</p>
                    <p className="text-2xl font-bold text-stone-900">{preview.taxes}</p>
                  </div>
                  <div className={`border rounded-lg p-3 ${preview.unmatched > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
                    <p className="text-xs text-stone-500">Unmatched</p>
                    <p className={`text-2xl font-bold ${preview.unmatched > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
                      {preview.unmatched}
                    </p>
                  </div>
                </div>

                {preview.unmatched > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      ⚠ {preview.unmatched} rows need review after import
                    </p>
                  </div>
                )}
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
                <p>✓ Orders: {importResult.orders.created} created, {importResult.orders.updated} updated</p>
                <p>✓ Fees: {importResult.fees.created} imported{importResult.fees.skipped > 0 && `, ${importResult.fees.skipped} duplicates skipped`}</p>
                <p>✓ Deposits: {importResult.deposits.created} tracked</p>
                {importResult.unmatched.count > 0 && (
                  <p className="text-amber-700">⚠ {importResult.unmatched.count} unmatched rows (review needed)</p>
                )}
              </div>
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
          {duplicateWarning && (
            <>
              <Button variant="outline" onClick={cancelDuplicate}>
                Cancel
              </Button>
              <Button onClick={confirmDuplicateImport} className="bg-amber-600 hover:bg-amber-700">
                Re-import Anyway
              </Button>
            </>
          )}
          {preview && !importResult && !duplicateWarning && (
            <>
              <Button variant="outline" onClick={() => { setPreview(null); setPendingData(null); }}>
                Cancel
              </Button>
              <Button onClick={confirmImport} className="bg-emerald-600 hover:bg-emerald-700">
                Confirm Import
              </Button>
            </>
          )}
          {!preview && !importing && !duplicateWarning && (
            <Button onClick={handleClose} variant="outline">
              {importResult ? "Done" : "Cancel"}
            </Button>
          )}
        </DialogFooter>
        </DialogContent>
        </Dialog>
        );
        }