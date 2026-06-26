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
        "Customer Name",
        "customer_name",
        "Name",
        "name"
      );

      if (!total && !subtotal) return null;

      return {
        date,
        vendor: customerName || "Squarespace Customer",
        description: `Squarespace Order ${orderId}`,
        payment_source: "Other",
        pre_tax_amount: subtotal || total - tax - shipping,
        sales_tax_collected: tax,
        gross_sale: total || subtotal,
        shipping_or_postage_cost: shipping,
        notes: `Imported from Squarespace. Order: ${orderId}`,
      };
    },
    getUniqueKey: (row) =>
      getVal(row, "Order ID", "order_id", "Order Number", "order_number"),
  },
};

export default function PlatformSalesImport({ open, onOpenChange, platform }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const config = PLATFORM_CONFIGS[platform];

  const handleImport = async (rows, parseRow, getUniqueKey) => {
    const existingSales = await base44.entities.CustomSale.filter({
      owner_user_id: user.id,
    });
    const existingKeys = new Set(existingSales.map((s) => s.description));

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
      existingKeys.add(descKey);
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