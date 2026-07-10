import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import CSVImporter from "@/components/shared/CSVImporter";

const parseMoney = (v) => {
  if (!v) return 0;
  const num = parseFloat(String(v).replace(/[\$,]/g, ""));
  return isNaN(num) ? 0 : num;
};

const parseDate = (v) => {
  if (!v) return new Date().toISOString().split("T")[0];
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
};

const getVal = (row, ...keys) => {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => k.toLowerCase().trim() === key.toLowerCase()
    );
    if (found && row[found]) return String(row[found]).trim();
  }
  return "";
};

const PLATFORM_CONFIGS = {
  square: {
    title: "Import Square Transactions",
    description:
      "Upload your Square Transactions CSV export. Each sale will be imported as a custom sale. Transactions already captured in your Etsy orders are automatically skipped to prevent duplicates.",
    parseRow: (row) => {
      const transactionId = getVal(row, "Transaction ID", "TransactionID", "transaction_id");
      const total = parseMoney(
        getVal(row, "Total Collected", "Total", "total", "Gross Amount", "Amount")
      );
      const grossSales = parseMoney(
        getVal(row, "Gross Sales", "GrossSales", "gross_sales", "gross_sale")
      );
      const tax = parseMoney(getVal(row, "Tax", "tax", "Sales Tax"));
      const netSales = parseMoney(getVal(row, "Net Sales", "NetSales", "net_sales"));
      const fee = parseMoney(
        getVal(row, "Fees", "Fee", "Processing Fee", "ProcessingFee", "processing_fee")
      );
      const date = parseDate(getVal(row, "Date", "date", "Transaction Date"));
      const customerName = getVal(
        row,
        "Customer Name",
        "customer_name",
        "Customer",
        "Buyer"
      );
      const eventType = getVal(row, "Event Type", "event_type");
      const source = getVal(row, "Source", "source");
      const status = getVal(row, "Transaction Status", "Status", "status");
      const orderRef = getVal(row, "Order Reference ID", "Order ID", "OrderID", "order_id");

      // Skip non-sale transactions (refunds, voided)
      const typeLower = String(eventType || "").toLowerCase();
      const statusLower = String(status || "").toLowerCase();
      if (statusLower === "voided" || statusLower === "refunded") return null;
      if (typeLower === "refund" || typeLower === "void") return null;

      const saleAmount = total || grossSales || netSales;
      if (!saleAmount) return null;

      const noteParts = [`Imported from Square. Transaction: ${transactionId || "N/A"}`];
      if (orderRef) noteParts.push(`Square Order: ${orderRef}`);
      if (source) noteParts.push(`Source: ${source}`);
      if (fee) noteParts.push(`Processing Fee: $${Math.abs(fee).toFixed(2)}`);

      // Use Square transaction ID in description for dedup
      const desc =
        transactionId || orderRef
          ? `Square Transaction ${transactionId || orderRef}`
          : `Square Sale ${date} $${saleAmount.toFixed(2)}`;

      return {
        date,
        vendor: customerName || "Square Customer",
        description: desc,
        payment_source: "Square",
        pre_tax_amount: grossSales ? grossSales - tax : saleAmount - tax,
        sales_tax_collected: tax,
        gross_sale: saleAmount,
        shipping_or_postage_cost: 0,
        notes: noteParts.join(" | "),
      };
    },
    getUniqueKey: (row) =>
      getVal(
        row,
        "Transaction ID",
        "TransactionID",
        "transaction_id",
        "Order Reference ID",
        "Order ID",
        "OrderID"
      ),
  },
  shopify: {
    title: "Import Shopify Sales",
    description:
      "Upload your Shopify orders CSV export. Each order will be imported as a custom sale.",
    parseRow: (row) => {
      const orderId = getVal(row, "Name", "Order", "Order Number", "name");
      const email = getVal(row, "Email", "email");
      const financialStatus = getVal(
        row,
        "Financial Status",
        "financial_status"
      );
      const fulfillmentStatus = getVal(
        row,
        "Fulfillment Status",
        "fulfillment_status"
      );
      const total = parseMoney(getVal(row, "Total", "total"));
      const subtotal = parseMoney(getVal(row, "Subtotal", "subtotal"));
      const shipping = parseMoney(getVal(row, "Shipping", "shipping"));
      const tax = parseMoney(getVal(row, "Taxes", "tax", "Tax"));
      const date = parseDate(
        getVal(
          row,
          "Paid at",
          "paid_at",
          "Created at",
          "created_at",
          "Date",
          "date"
        )
      );
      const customerName = getVal(
        row,
        "Billing Name",
        "Shipping Name",
        "Customer Name",
        "customer_name"
      );

      // Skip voided orders — they have no real revenue impact
      if (financialStatus.toLowerCase() === "voided") return null;
      if (!total && !subtotal) return null;

      const noteParts = [`Imported from Shopify. Order: ${orderId}`];
      if (financialStatus) noteParts.push(`Financial: ${financialStatus}`);
      if (fulfillmentStatus) noteParts.push(`Fulfillment: ${fulfillmentStatus}`);
      if (email) noteParts.push(`Email: ${email}`);

      return {
        date,
        vendor: customerName || "Shopify Customer",
        description: `Shopify Order ${orderId}`,
        payment_source: "Other",
        pre_tax_amount: subtotal || total - tax - shipping,
        sales_tax_collected: tax,
        gross_sale: total || subtotal,
        shipping_or_postage_cost: shipping,
        notes: noteParts.join(" | "),
      };
    },
    getUniqueKey: (row) =>
      getVal(row, "Name", "Order", "Order Number", "name"),
  },
  squarespace: {
    title: "Import Squarespace Sales",
    description:
      "Upload your Squarespace orders CSV export. Each order will be imported as a custom sale.",
    parseRow: (row) => {
      const orderId = getVal(
        row,
        "Order #",
        "Order ID",
        "order_id",
        "Order Number",
        "order_number"
      );
      const total = parseMoney(
        getVal(row, "Total", "total", "Grand Total", "grand_total")
      );
      const subtotal = parseMoney(getVal(row, "Subtotal", "subtotal"));
      const shipping = parseMoney(getVal(row, "Shipping", "shipping"));
      const tax = parseMoney(getVal(row, "Tax", "tax", "Taxes"));
      const date = parseDate(
        getVal(
          row,
          "Date",
          "date",
          "Order Date",
          "order_date",
          "Placed On",
          "placed_on"
        )
      );
      const customerName = getVal(
        row,
        "Customer",
        "Customer Name",
        "customer_name",
        "Name",
        "name"
      );
      const items = getVal(row, "Item(s)", "Items", "items", "Item");
      const status = getVal(row, "Status", "status");

      // Skip cancelled orders — they have no real revenue impact
      if (status.toLowerCase() === "cancelled") return null;
      if (!total && !subtotal) return null;

      const noteParts = [`Imported from Squarespace. Order: ${orderId}`];
      if (status) noteParts.push(`Status: ${status}`);
      if (items) noteParts.push(`Items: ${items}`);

      return {
        date,
        vendor: customerName || "Squarespace Customer",
        description: `Squarespace Order ${orderId}`,
        payment_source: "Other",
        pre_tax_amount: subtotal || total - tax - shipping,
        sales_tax_collected: tax,
        gross_sale: total || subtotal,
        shipping_or_postage_cost: shipping,
        notes: noteParts.join(" | "),
      };
    },
    getUniqueKey: (row) =>
      getVal(
        row,
        "Order #",
        "Order ID",
        "order_id",
        "Order Number",
        "order_number"
      ),
  },
};

export default function PlatformSalesImport({ open, onOpenChange, platform }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const config = PLATFORM_CONFIGS[platform];

  const handleImport = async (rows, parseRow, getUniqueKey) => {
    const [existingSales, existingEtsyOrders] = await Promise.all([
      base44.entities.CustomSale.filter({ owner_user_id: user.id }, '-date', 1000),
      // For Square imports, also cross-check against Etsy orders so in-person
      // Square sales already captured via Etsy's Sold Orders Report aren't duplicated
      platform === "square"
        ? base44.entities.EtsyOrder.filter({ owner_user_id: user.id }, '-sale_date', 1000)
        : Promise.resolve([]),
    ]);

    const existingKeys = new Set(existingSales.map((s) => s.description));

    // Build date+amount lookup from existing CustomSales (catches invoice-created dupes)
    const customSaleDateAmountKeys = new Set();
    existingSales.forEach((s) => {
      if (s.date && s.gross_sale) {
        customSaleDateAmountKeys.add(`${s.date}|${Number(s.gross_sale).toFixed(2)}`);
      }
    });

    // Build a robust lookup from Etsy orders for fuzzy matching.
    // Square's "Total Collected" can differ from Etsy's "Order Total" by a few dollars
    // (e.g. $3 Square processing fee), so we store each order as { date, amounts[] }
    // and match with a $5 tolerance + date ± 1 day for timezone shifts.
    const etsyOrdersForMatching = existingEtsyOrders.map((o) => ({
      sale_date: o.sale_date,
      amounts: [o.order_total, o.adjusted_order_total, o.order_value, o.order_net, o.adjusted_net_order_amount]
        .filter((a) => a != null && !isNaN(a)),
    }));
    const dateShift = (dateStr, deltaDays) => {
      const d = new Date(dateStr + "T00:00:00");
      d.setDate(d.getDate() + deltaDays);
      return d.toISOString().split("T")[0];
    };
    const fuzzyMatchEtsy = (date, amount) => {
      if (!date || !amount) return false;
      for (let delta = -1; delta <= 1; delta++) {
        const d = dateShift(date, delta);
        for (const o of etsyOrdersForMatching) {
          if (!o.sale_date) continue;
          const oDate = dateShift(o.sale_date, delta);
          if (oDate !== d) continue;
          for (const oAmt of o.amounts) {
            if (Math.abs(oAmt - amount) <= 5) return true;
          }
        }
      }
      return false;
    };

    const toCreate = [];
    const skipped = [];

    for (const row of rows) {
      const parsed = parseRow(row);
      if (!parsed) {
        skipped.push({ row, reason: "Missing total or subtotal amount" });
        continue;
      }
      const descKey = parsed.description;
      if (descKey && existingKeys.has(descKey)) {
        skipped.push({ row, reason: "Duplicate order already imported" });
        continue;
      }
      // Check against existing CustomSales by date + amount
      if (parsed.date && parsed.gross_sale) {
        const dateAmountKey = `${parsed.date}|${Number(parsed.gross_sale).toFixed(2)}`;
        if (customSaleDateAmountKeys.has(dateAmountKey)) {
          skipped.push({ row, reason: "Duplicate sale (same date + amount already exists)" });
          continue;
        }
        // Cross-check against Etsy orders with fuzzy amount matching ($5 tolerance + date ± 1 day)
        if (platform === "square" && fuzzyMatchEtsy(parsed.date, parsed.gross_sale)) {
          skipped.push({ row, reason: "Already exists as an Etsy order (in-person Square sale)" });
          continue;
        }
      }
      existingKeys.add(descKey);
      if (parsed.date && parsed.gross_sale) {
        customSaleDateAmountKeys.add(`${parsed.date}|${Number(parsed.gross_sale).toFixed(2)}`);
      }
      toCreate.push({ ...parsed, owner_user_id: user.id });
    }

    let added = 0;
    if (toCreate.length > 0) {
      const created = await base44.entities.CustomSale.bulkCreate(toCreate);
      added = created.length;
    }

    queryClient.invalidateQueries({ queryKey: ["custom-sales"] });

    return {
      success: true,
      added,
      updated: 0,
      skipped: skipped.length,
      skippedRecords: skipped,
    };
  };

  if (!config) return null;

  return (
    <CSVImporter
      open={open}
      onOpenChange={onOpenChange}
      title={config.title}
      description={config.description}
      onImport={handleImport}
      parseRow={config.parseRow}
      getUniqueKey={config.getUniqueKey}
    />
  );
}