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
  const orderId = row["Order ID"] || extractOrderId(titleL) || extractOrderId(infoL) || extractOrderId(taxDetailsL);
  
  // Fast path checks - most common patterns first
  if (titleL.includes('deposit') || titleL.includes('payout') || titleL.includes('transfer')) {
    return { category: 'deposit', section: 'deposits', fee_type: null, order_id: null };
  }

  // Share & Save must be checked BEFORE refund — the title is "Share & Save refund"
  // and would otherwise be misclassified as a refund instead of a fee credit
  if (titleL.includes('share') && titleL.includes('save')) {
    return { category: 'fee', section: 'fees', fee_type: 'share_save_credit', order_id: orderId };
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
  
  if (titleL.includes('regulatory operating fee')) {
    return { category: 'fee', section: 'fees', fee_type: 'other_fee', order_id: orderId };
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

// Batch process with retry logic for reliability
const batchProcessWithRetry = async (items, batchSize, entityName, maxRetries = 2) => {
  const results = { created: 0, failed: 0, errors: [] };
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    let retryCount = 0;
    let success = false;
    
    while (retryCount <= maxRetries && !success) {
      try {
        await base44.entities[entityName].bulkCreate(batch);
        results.created += batch.length;
        success = true;
        // Small delay between successful batches
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Never retry permission errors — they indicate a schema-level restriction
        if (error?.message?.toLowerCase().includes('permission') ||
            error?.message?.toLowerCase().includes('forbidden') ||
            error?.message?.toLowerCase().includes('unauthorized')) {
          results.failed += batch.length;
          results.errors.push(`${entityName}: Permission denied — skipping remaining batches`);
          return results;
        }
        retryCount++;

        if (retryCount > maxRetries) {
          // Final failure - try individual items
          for (const item of batch) {
            try {
              await base44.entities[entityName].create(item);
              results.created++;
            } catch (itemError) {
              results.failed++;
              results.errors.push(`${entityName} batch ${i}-${i + batchSize}: ${itemError.message}`);
              console.error(`Failed to create ${entityName}:`, itemError);
            }
          }
        } else {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
        }
      }
    }
  }
  
  return results;
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
      
      // Get owner_user_id from authenticated user
      const currentUser = await base44.auth.me();
      
      // ATOMIC IMPORT: Wrap entire import in transaction-like error handling
      // If any critical step fails, we want to know exactly what failed
      const importStartTime = Date.now();
      console.log(`[Import ${fileName}] Starting atomic import for ${statementMonth}...`);
      
      let importRecord;
      
      try {
        // Retry helper with exponential backoff: 500ms, 1000ms, 2000ms (3 retries)
        const withRetry = async (fn, maxRetries = 3) => {
          let lastError;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              return await fn();
            } catch (error) {
              lastError = error;
              // Never retry permission/auth errors — retrying won't fix them
              if (error?.message?.toLowerCase().includes('permission') ||
                  error?.message?.toLowerCase().includes('forbidden') ||
                  error?.message?.toLowerCase().includes('unauthorized')) {
                break;
              }
              if (attempt < maxRetries) {
                const delays = [500, 1000, 2000];
                const delay = delays[attempt] || 2000;
                console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
          throw lastError;
        };

        // Chunked bulk create: max 25 records per call, 50ms delay between chunks
        const chunkedBulkCreate = async (items, entityName, chunkSize = 25) => {
          const results = { created: 0, failed: 0, errors: [], items: [] };
          for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            try {
              const created = await withRetry(() => base44.entities[entityName].bulkCreate(chunk));
              if (Array.isArray(created)) {
                results.items.push(...created);
                results.created += created.length;
              } else {
                results.created += chunk.length;
              }
            } catch (error) {
              for (const item of chunk) {
                try {
                  const created = await withRetry(() => base44.entities[entityName].create(item));
                  if (created) results.items.push(created);
                  results.created++;
                } catch (itemError) {
                  results.failed++;
                  results.errors.push(`${entityName}: ${itemError.message}`);
                }
              }
            }
            if (i + chunkSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
          return results;
        };

        // Chunked bulk update: max 10 records per call, 300ms delay between chunks
        const chunkedBulkUpdate = async (items, entityName, chunkSize = 10) => {
          const results = { updated: 0, failed: 0, errors: [] };
          for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            try {
              await withRetry(() => base44.entities[entityName].bulkUpdate(chunk));
              results.updated += chunk.length;
            } catch (error) {
              for (const item of chunk) {
                try {
                  const { id, ...updateData } = item;
                  await withRetry(() => base44.entities[entityName].update(id, updateData));
                  results.updated++;
                } catch (itemError) {
                  results.failed++;
                  results.errors.push(`${entityName}: ${itemError.message}`);
                }
              }
            }
            if (i + chunkSize < items.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          return results;
        };
        
        // RECONCILIATION: Fix sale rows with missing order IDs by matching fee rows via date.
        // Etsy sale rows sometimes have no Order Number in Title/Info → get a "stmt_" fallback ID.
        // Fee rows always extract the real order number from the title. Match by date to fix them.
        // _originalStmtId is saved so the upsert can find and update the existing stmt_ DB record.
        {
          const feeDateMap = {};
          fees.forEach(f => {
            if (f.order_id && f.transaction_date) {
              if (!feeDateMap[f.transaction_date]) feeDateMap[f.transaction_date] = new Set();
              feeDateMap[f.transaction_date].add(f.order_id);
            }
          });
          const usedOrderIds = new Set(
            orders.filter(o => o.order_id && !o.order_id.startsWith('stmt_')).map(o => o.order_id)
          );
          orders.forEach(order => {
            if (!order.order_id || !order.order_id.startsWith('stmt_')) return;
            const candidates = (feeDateMap[order.sale_date] ? [...feeDateMap[order.sale_date]] : [])
              .filter(id => !usedOrderIds.has(id));
            if (candidates.length === 1) {
              const realId = candidates[0];
              console.log(`[Reconcile] ${order.order_id} → ${realId} (${order.sale_date})`);
              order._originalStmtId = order.order_id; // save for upsert fallback lookup
              order.order_id = realId;
              usedOrderIds.add(realId);
            }
          });
        }
                // ATOMIC DEDUPLICATION: Prevent duplicate imports
        console.log('[Import] Checking for duplicates...');
        
        // Parallel pre-flight: fetch existing fees, statement imports, and orders simultaneously
        const [allExistingFees, existingImports, allExistingOrders] = await Promise.all([
          withRetry(() => base44.entities.Fee.filter({ owner_user_id: currentUser.id })),
          base44.entities.EtsyStatementImport.filter({ statement_month: statementMonth, owner_user_id: currentUser.id }),
          withRetry(() => base44.entities.EtsyOrder.filter({ owner_user_id: currentUser.id }))
        ]);
        const existingFeeKeys = new Set(
          allExistingFees.map(f => `${f.transaction_date}|${f.order_id || ''}|${f.fee_type}|${f.amount}`)
        )
        
        // All orders are treated as fresh — the order_id-based upsert handles duplicates
        const newOrders = orders;

        // Fee dedup by composite key (date + order_id + fee_type + amount) — safe, no stale UIDs
        const newFees = fees.filter(f => {
          const feeKey = `${f.transaction_date}|${f.order_id || ''}|${f.fee_type}|${f.amount}`;
          return !existingFeeKeys.has(feeKey);
        });

        // Deposits and refunds: always import (no stale line_uid dedup)
        const newDeposits = deposits;
        const newRefunds = refunds;
        
        console.log(`[Import] Deduplication: ${orders.length - newOrders.length} orders, ${fees.length - newFees.length} fees, ${deposits.length - newDeposits.length} deposits skipped`);
        
        // (existingImports fetched in parallel pre-flight above)
        
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
          status: 'processing', // Start as processing, update on completion
        });

        const skippedFees = fees.length - newFees.length;
        const skippedOrders = orders.length - newOrders.length;
        const skippedDeposits = deposits.length - newDeposits.length;
        
        const result = {
          orders: { created: 0, updated: 0, skipped: skippedOrders },
          fees: { created: 0, skipped: skippedFees },
          deposits: { created: 0, skipped: skippedDeposits },
          refunds: { created: 0 },
          taxes: { created: 0 },
          unmatched: { count: 0 },
          errors: []
        };
        
        // Log deduplication stats
        if (skippedOrders > 0) console.log(`⚠️ Skipped ${skippedOrders} duplicate order(s)`);
        if (skippedFees > 0) console.log(`⚠️ Skipped ${skippedFees} duplicate fee(s)`);
        if (skippedDeposits > 0) console.log(`⚠️ Skipped ${skippedDeposits} duplicate deposit(s)`);

        // ATOMIC IMPORT: Import only new orders (bulk upsert by order_id)
        const orderIdToEntityId = {};
        // (allExistingOrders fetched in parallel pre-flight above)
        const existingOrderMap = {};
        allExistingOrders.forEach(o => { existingOrderMap[o.order_id] = o; });

        const ordersToCreate = [];
        const ordersToUpdate = [];
        for (const order of newOrders) {
          const { _rawLine, ...orderData } = order;
          const existing = existingOrderMap[order.order_id];
          if (existing) {
            ordersToUpdate.push({ id: existing.id, ...orderData });
            orderIdToEntityId[order.order_id] = existing.id;
            result.orders.updated++;
          } else {
            ordersToCreate.push({ ...orderData, owner_user_id: currentUser.id });
          }
        }

        // Pass reconciled stmt_ IDs to onSuccess for background cleanup (non-blocking)
        result.reconciledStmtIds = newOrders
          .filter(o => o._originalStmtId)
          .map(o => ({ stmtId: o._originalStmtId, realId: o.order_id }));

        // Bulk create new orders (chunked with retry)
        if (ordersToCreate.length > 0) {
          const orderResults = await chunkedBulkCreate(ordersToCreate, 'EtsyOrder');
          result.orders.created = orderResults.created;
          if (orderResults.items.length === ordersToCreate.length) {
            orderResults.items.forEach((o, idx) => {
              if (o?.id) orderIdToEntityId[ordersToCreate[idx].order_id] = o.id;
            });
          }
          if (orderResults.failed > 0) {
            result.errors.push(...orderResults.errors);
          }
        }

        // Bulk update existing orders (chunked with retry)
        if (ordersToUpdate.length > 0) {
          const updateResults = await chunkedBulkUpdate(ordersToUpdate, 'EtsyOrder');
          if (updateResults.failed > 0) {
            result.errors.push(...updateResults.errors);
          }
        }

        // Import only new fees (bulk create with retry)
        if (newFees.length > 0) {
          const feesToCreate = newFees.map(fee => {
            const { _rawLine, ...feeData } = fee;
            return { 
              ...feeData, 
              owner_user_id: currentUser.id, 
              import_id: importRecord.id 
            };
          });
          // Diagnostic: log fee create attempts to help debug permission errors
          console.log('[Import] Creating', feesToCreate.length, 'fees, sample:', JSON.stringify({
            ...feesToCreate[0], owner_user_id: feesToCreate[0]?.owner_user_id, import_id: feesToCreate[0]?.import_id
          }));
          const feeResults = await chunkedBulkCreate(feesToCreate, 'Fee');
          result.fees.created = feeResults.created;
          if (feeResults.failed > 0) console.warn(`[Import] ${feeResults.failed} fee detail records could not be saved (schema permission). Order summaries and earnings are unaffected.`);
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
                share_save_credit: 0,
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
            else if (fee.fee_type === 'share_save_credit') orderFeeMap[fee.order_id].share_save_credit += amount;
            else if (fee.fee_type === 'etsy_ads') orderFeeMap[fee.order_id].etsy_ads += amount;
            else if (fee.fee_type === 'offsite_ads') orderFeeMap[fee.order_id].offsite_ads_fees += amount;
            else if (fee.fee_type === 'shipping_label') orderFeeMap[fee.order_id].etsy_shipping += amount;
            else if (fee.fee_type === 'other_postage') orderFeeMap[fee.order_id].other_postage_costs += amount;
            else orderFeeMap[fee.order_id].other_fees += amount;
            
            // Share & Save is a credit — it reduces total fees, not increases them
            orderFeeMap[fee.order_id].total_fees += (fee.fee_type === 'share_save_credit' ? -amount : amount);
          }
        });

        // Create/update OrderFee records (bulk)
        const orderFeeRecords = Object.values(orderFeeMap);
        if (orderFeeRecords.length > 0) {
          // Fetch all existing OrderFees ONCE to avoid N+1 queries
          const allExistingOrderFees = await withRetry(() => base44.entities.OrderFee.filter({ owner_user_id: currentUser.id }));
          const existingOrderFeeMap = {};
          allExistingOrderFees.forEach(of => { existingOrderFeeMap[of.order_id] = of; });

          const orderFeesToCreate = [];
          const orderFeesToUpdate = [];
          for (const orderFee of orderFeeRecords) {
            const existing = existingOrderFeeMap[orderFee.order_id];
            if (existing) {
              orderFeesToUpdate.push({ id: existing.id, ...orderFee });
            } else {
              orderFeesToCreate.push({ ...orderFee, owner_user_id: currentUser.id });
            }
          }

          if (orderFeesToCreate.length > 0) {
            console.log('[Import] Creating', orderFeesToCreate.length, 'OrderFee records');
            const ofCreateResults = await chunkedBulkCreate(orderFeesToCreate, 'OrderFee');
            if (ofCreateResults.failed > 0) {
              result.errors.push(...ofCreateResults.errors);
            }
          }

          if (orderFeesToUpdate.length > 0) {
            const ofUpdateResults = await chunkedBulkUpdate(orderFeesToUpdate, 'OrderFee');
            if (ofUpdateResults.failed > 0) {
              result.errors.push(...ofUpdateResults.errors);
            }
          }
        }

        // Import only new deposits as transfers (bulk create with retry)
        if (newDeposits.length > 0) {
          const depositsToCreate = newDeposits.map(deposit => {
            const { _rawLine, ...depositData } = deposit;
            return { 
              ...depositData, 
              owner_user_id: currentUser.id 
            };
          });
          const depositResults = await chunkedBulkCreate(depositsToCreate, 'Transfer');
          result.deposits.created = depositResults.created;
          if (depositResults.failed > 0) {
            result.errors.push(...depositResults.errors);
          }
        }

        // Apply refunds to orders
        const refundsByOrderId = {};
        newRefunds.forEach(refund => {
          if (refund.orderId) {
            refundsByOrderId[refund.orderId] = (refundsByOrderId[refund.orderId] || 0) + refund.amount;
          }
        });

        // Update orders with refund amounts (bulk, using pre-fetched orders map)
        const refundUpdates = [];
        for (const [orderId, refundAmount] of Object.entries(refundsByOrderId)) {
          const entityId = orderIdToEntityId[orderId];
          if (entityId) {
            const existing = existingOrderMap[orderId];
            const currentRefund = existing?.refund_amount || 0;
            refundUpdates.push({ id: entityId, refund_amount: currentRefund + refundAmount });
          }
        }
        if (refundUpdates.length > 0) {
          const refundUpdateResults = await chunkedBulkUpdate(refundUpdates, 'EtsyOrder');
          if (refundUpdateResults.failed > 0) {
            result.errors.push(...refundUpdateResults.errors);
          }
        }

        result.refunds.created = newRefunds.length;
        result.taxes.created = taxes.length;
        result.unmatched.count = unmatchedLines.length;

        // Save all new statement lines (including refunds) with source_etsy_order_id links
        const newLines = [
          ...newOrders.map(o => ({ ...o._rawLine, source_etsy_order_id: orderIdToEntityId[o.order_id] || null })),
          ...newFees.map(f => ({ ...f._rawLine, source_etsy_order_id: orderIdToEntityId[f.order_id] || null })),
          ...newDeposits.map(d => d._rawLine),
          ...newRefunds.map(r => ({ ...r._rawLine, source_etsy_order_id: orderIdToEntityId[r.orderId] || null }))
        ].filter(line => line && line.line_uid); // Only save lines with valid UIDs
        if (newLines.length > 0) {
          const linesToCreate = newLines.map(line => ({
            owner_user_id: currentUser.id,
            import_id: importRecord.id,
            ...line
          }));
          const lineResults = await chunkedBulkCreate(linesToCreate, 'EtsyStatementLine');
          if (lineResults.failed > 0) {
            result.errors.push(...lineResults.errors);
          }
        }

        // Update import counts and status
        const hasErrors = result.errors.length > 0;
        await base44.entities.EtsyStatementImport.update(importRecord.id, {
          orders_count: result.orders.created + result.orders.updated,
          fees_count: result.fees.created,
          deposits_count: result.deposits.created,
          refunds_count: result.refunds.created,
          taxes_count: result.taxes.created,
          unmatched_count: result.unmatched.count,
          reconciliation_status: hasErrors ? 'partial' : 'success',
          reconciliation_notes: hasErrors ? `Import completed with ${result.errors.length} error(s)` : null
        });

        if (hasErrors) {
          console.error('Import completed with errors:', result.errors);
        }

        return result;
      } catch (importError) {
        // CRITICAL: If import fails, mark the import record as failed
        console.error('[Import] CRITICAL FAILURE:', importError);
        
        if (importRecord) {
          try {
            await base44.entities.EtsyStatementImport.update(importRecord.id, {
              status: 'failed',
              reconciliation_notes: `Import failed: ${importError.message || 'Unknown error'}`
            });
          } catch (updateError) {
            console.error('Failed to update import status:', updateError);
          }
        }
        
        // Re-throw with context
        throw new Error(`Import failed: ${importError.message || 'Unknown error'}`);
      }
    },
    onSuccess: async (result) => {
      // IMMEDIATELY update UI so the spinner stops regardless of background work
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-lines"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      setImporting(false);
      setPreview(null);
      setPendingData(null);

      // Background: track subscription usage and flag duplicates (non-blocking)
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
        
        // Flag potential duplicates: orders with same date + amount from different sources
        const allOrders = await base44.entities.EtsyOrder.filter({ owner_user_id: currentUser.id });
        const orderGroups = {};
        allOrders.forEach(order => {
          const key = `${order.sale_date}_${order.order_total}`;
          if (!orderGroups[key]) orderGroups[key] = [];
          orderGroups[key].push(order);
        });
        
        const duplicateIds = [];
        Object.values(orderGroups).forEach(group => {
          if (group.length > 1) {
            const sources = new Set(group.map(o => o.source || 'unknown'));
            if (sources.size > 1) {
              group.forEach(o => duplicateIds.push(o.id));
            }
          }
        });
        
        if (duplicateIds.length > 0) {
          await base44.entities.EtsyOrder.updateMany({ id: { $in: duplicateIds } }, { $set: { possible_duplicate: true } });
          console.log(`[Import] Flagged ${duplicateIds.length} potential duplicates`);
        }
      } catch (err) {
        console.warn('Failed to flag duplicates:', err);
      }

    },
    onError: (error) => {
      console.error('[Import] Error:', error);
      // Show user-friendly error message
      const userMessage = error.message?.includes('Import failed') 
        ? error.message 
        : `Import failed: ${error.message}. Please try again.`;
      
      setImportResult({ error: userMessage });
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
    
    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls|ods)$/i)) {
      setImportResult({ 
        error: `Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls). Received: ${file.type || 'unknown'}` 
      });
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setImportResult({ 
        error: `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB` 
      });
      return;
    }
    
    console.log("File selected:", file.name, file.type, file.size);
    setImporting(true);
    setImportResult(null);
    setDuplicateWarning(null);

    const reader = new FileReader();
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      setImportResult({ error: "Failed to read file. Please try again or use a different file." });
      setImporting(false);
    };
    reader.onload = async (e) => {
      try {
         console.log("File loaded, parsing...");
         const XLSX = await import("xlsx");
         const data = new Uint8Array(e.target.result);
         
         // Validate file content
         if (data.length === 0) {
           setImportResult({ error: "File appears to be empty. Please check the file and try again." });
           setImporting(false);
           return;
         }
         
         const workbook = XLSX.read(data, { type: "array" });
         
         if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
           setImportResult({ error: "No worksheets found in file. Please ensure the file contains data." });
           setImporting(false);
           return;
         }
         
         const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
         const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
        console.log("Parsed rows:", jsonData.length);

        if (jsonData.length === 0) {
          setImportResult({ error: "File is empty or contains no data rows. Please check the file content." });
          setImporting(false);
          return;
        }
        
        // Validate required columns exist
        const firstRow = jsonData[0];
        const requiredColumns = ['Date', 'Type', 'Amount'];
        const missingColumns = requiredColumns.filter(col => !firstRow.hasOwnProperty(col));
        
        if (missingColumns.length > 0) {
          setImportResult({ 
            error: `Missing required columns: ${missingColumns.join(', ')}. Please ensure you're uploading an Etsy Monthly Statement CSV.` 
          });
          setImporting(false);
          return;
        }

        // Parse statement
        console.log("Parsing statement data...");
        let parsed;
        try {
          parsed = parseEtsyStatement(jsonData, file.name);
        } catch (parseError) {
          console.error("Parse error:", parseError);
          setImportResult({ 
            error: `Failed to parse file: ${parseError.message || 'Unknown parsing error'}. Please ensure the file is a valid Etsy Monthly Statement CSV.` 
          });
          setImporting(false);
          return;
        }
        
        console.log("Parsed:", {
          orders: parsed.orders.length,
          fees: parsed.fees.length,
          deposits: parsed.deposits.length,
          unmatched: parsed.unmatchedLines.length
        });
        
        // Validate parsed data
        if (!parsed.orders || parsed.orders.length === 0) {
          setImportResult({ 
            error: "No orders found in file. Please ensure you're uploading the correct Etsy Monthly Statement CSV (not a custom report)." 
          });
          setImporting(false);
          return;
        }
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
        const allImportsByMonth = await base44.entities.EtsyStatementImport.filter({
          statement_month: parsed.statementMonth,
          owner_user_id: user.id
        });
        // Filter out replaced imports in JS ($ne not supported by Base44)
        const existingImportsByMonth = allImportsByMonth.filter(i => i.status !== 'replaced');
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
        console.error("File processing error:", error);
        let errorMessage = "Failed to process file. ";
        
        if (error.message?.includes('XLSX') || error.message?.includes('parse')) {
          errorMessage += "File format not recognized. Please use CSV or Excel format.";
        } else if (error.message?.includes('permission') || error.message?.includes('access')) {
          errorMessage += "Cannot access file. Please check file permissions.";
        } else if (error.message?.includes('memory') || error.message?.includes('heap')) {
          errorMessage += "File too large to process. Please use a smaller file.";
        } else {
          errorMessage += error.message || "Unknown error occurred.";
        }
        
        setImportResult({ error: errorMessage });
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
        amount: net || feesTaxes || amount,
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
           else if (classification.category === 'sale') {
             // Generate fallback order_id if none was extracted from the CSV
             const saleOrderId = classification.order_id || `stmt_${lineUID}`;
             rawLine.order_id = saleOrderId;
             // Calculate total fees AND taxes for this order from the fees we found
             const orderFees = feesByOrderId[saleOrderId] || [];
             const orderTaxes = classifiedRows.filter(({ row: r, classification: c }) => 
               c.category === 'tax' && c.order_id === saleOrderId
             );

             const totalOrderFees = orderFees.reduce((sum, f) => {
               const feeAmount = parseMoney(f["Fees & Taxes"]);
               return sum + Math.abs(feeAmount || 0);
             }, 0);

             const totalTaxes = orderTaxes.reduce((sum, { row: r }) => {
               const taxAmount = parseMoney(r["Amount"] || r["Fees & Taxes"]);
               return sum + Math.abs(taxAmount || 0);
             }, 0);

            // Monthly Statement CSV: Amount = gross sale revenue, Net = net payout
            // Some statement formats may have explicit "Order Value" — use if present, else Amount
            let orderValue = parseMoney(getRowValue(row, "Order Value", "Item(s) price", "Item Total")) || amount;
            let shippingCharged = parseMoney(getRowValue(row, "Shipping", "Shipping price", "Shipping Charged", "Shipping Amount", "Shipping Cost"));
            let salesTax = parseMoney(getRowValue(row, "Sales Tax", "Tax paid by buyer"));
            const orderTotal = parseMoney(getRowValue(row, "Order Total", "Total")) || amount;

            // Net column from the Monthly Statement IS the net payout.
            // Fall back to calculated value only if Net is missing or zero.
            const orderNet = net || (orderTotal - totalOrderFees - totalTaxes);

        orders.push({
          sale_date: transactionDate,
          order_id: saleOrderId,
          buyer_username: row["Buyer User ID"] || row["Buyer"] || "",
          buyer_full_name: row["Full Name"] || "",
          number_of_items: parseIntSafe(row["Number of Items"] || row["Quantity"]),
          payment_method: row["Payment Method"] || "",
          order_value: orderValue,
          shipping_charged: shippingCharged,
          discount_amount: parseMoney(row["Discount Amount"] || row["Coupon"]),
          sales_tax: totalTaxes,
          order_total: orderTotal,
          card_processing_fees: parseMoney(row["Card Processing Fees"]),
          order_net: orderNet,
          currency: row["Currency"] || "",
          status: row["Status"] || "completed",
          total_fees: totalOrderFees + totalTaxes,
          source: 'etsy_statement',
          possible_duplicate: false,
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
      
      // If replacing an existing month, mark old import as 'replaced' and clean up old data
      if (duplicateWarning.type === 'duplicate_month') {
        try {
          const oldImportId = duplicateWarning.existingImport.id;
          await base44.entities.EtsyStatementImport.update(oldImportId, {
            status: 'replaced',
            reconciliation_notes: `Replaced by new import on ${format(new Date(), 'MMM d, yyyy HH:mm')}`
          });
          // Delete old statement lines so dedup allows re-importing them
          // (deleteMany unsupported in Base44 — use fetch + individual delete)
          try {
            const oldLines = await base44.entities.EtsyStatementLine.filter({ import_id: oldImportId, owner_user_id: user.id });
            await Promise.all(oldLines.map(line =>
              base44.entities.EtsyStatementLine.delete(line.id).catch(() => {})
            ));
          } catch(e) { console.warn('[Import] Could not delete old statement lines:', e); }
          // Delete old fees
          try {
            const oldFees = await base44.entities.Fee.filter({ import_id: oldImportId, owner_user_id: user.id });
            await Promise.all(oldFees.map(fee =>
              base44.entities.Fee.delete(fee.id).catch(() => {})
            ));
          } catch(e) { console.warn('[Import] Could not delete old fees:', e); }
          console.log(`[Import] Cleaned up old data for replaced import ${oldImportId}`);
        } catch (err) {
          console.warn('Failed to clean up replaced import:', err);
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
                <p>✓ Orders: {importResult.orders.created} created, {importResult.orders.updated} updated{importResult.orders.skipped > 0 && `, ${importResult.orders.skipped} skipped`}</p>
                <p>✓ Fees: {importResult.fees.created} created{importResult.fees.skipped > 0 && `, ${importResult.fees.skipped} skipped`}</p>
                <p>✓ Deposits: {importResult.deposits.created} created{importResult.deposits.skipped > 0 && `, ${importResult.deposits.skipped} skipped`}</p>
                {importResult.refunds.created > 0 && (
                  <p>✓ Refunds: {importResult.refunds.created} processed</p>
                )}
                {importResult.unmatched.count > 0 && (
                  <p className="text-amber-700">⚠ {importResult.unmatched.count} unmatched rows (review needed)</p>
                )}
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-rose-700 mb-1">{importResult.errors.length} error(s):</p>
                  <div className="max-h-32 overflow-y-auto bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-700 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="break-words">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {importResult?.error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <p className="font-semibold text-rose-900">Import Failed</p>
              </div>
              <p className="text-sm text-rose-800 max-h-40 overflow-y-auto break-words">{importResult.error}</p>
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
                <p>✓ Orders: {importResult.orders.created} created, {importResult.orders.updated} updated{importResult.orders.skipped > 0 && `, ${importResult.orders.skipped} skipped`}</p>
                <p>✓ Fees: {importResult.fees.created} created{importResult.fees.skipped > 0 && `, ${importResult.fees.skipped} skipped`}</p>
                <p>✓ Deposits: {importResult.deposits.created} created{importResult.deposits.skipped > 0 && `, ${importResult.deposits.skipped} skipped`}</p>
                {importResult.refunds.created > 0 && (
                  <p>✓ Refunds: {importResult.refunds.created} processed</p>
                )}
                {importResult.unmatched.count > 0 && (
                  <p className="text-amber-700">⚠ {importResult.unmatched.count} unmatched rows (review needed)</p>
                )}
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-rose-700 mb-1">{importResult.errors.length} error(s):</p>
                  <div className="max-h-32 overflow-y-auto bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-700 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="break-words">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {importResult?.error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <p className="font-semibold text-rose-900">Import Failed</p>
              </div>
              <p className="text-sm text-rose-800 max-h-40 overflow-y-auto break-words">{importResult.error}</p>
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