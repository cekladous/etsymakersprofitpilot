import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { getEntitlements } from "../../shared/subscriptionGuard.ts";

// App-specific AI operations for the maker workflows. Every prompt and response
// schema is defined here, never supplied by the caller, so this is NOT a generic
// LLM proxy — it only runs the fixed operations the UI needs.
//
// Paid-only operations (AI price suggestion / labor estimate) are gated here on
// the server with the same entitlement logic as the rest of the backend, so the
// plan cannot be bypassed by calling the integration directly from a browser.

const CHASE_SCHEMA = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "Transaction date in YYYY-MM-DD format (e.g., 2025-07-15). Always include the full 4-digit year." },
          description: { type: "string", description: "Transaction description or merchant name" },
          amount: { type: "number", description: "Transaction amount as a numeric value (positive for debits/charges, negative for credits/refunds)" },
        },
        required: ["date", "description", "amount"],
      },
    },
  },
};

function text(value, max = 200) {
  return String(value ?? "").slice(0, max);
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

async function canUsePaidAI(base44, user) {
  const entitlements = await getEntitlements(base44, user);
  return Boolean(entitlements.admin || entitlements.features.aiEstimator);
}

function buildPricePrompt(projectName, materialsDesc, materialsTotal) {
  return `You are a pricing expert for handmade Etsy products.

Project Details:
- Product: ${projectName}
- Materials used: ${materialsDesc}
- Material Cost: $${materialsTotal.toFixed(2)}

Search Etsy marketplace for similar products:
1. Find items with matching or similar materials (e.g., acrylic, wood, leather signs)
2. Look at current average pricing for these items on Etsy
3. Consider what successful sellers charge for comparable handmade/custom work
4. Account for Etsy's fees when pricing

Suggest a price that:
- Reflects current average Etsy market rates for similar items
- Covers costs + reasonable profit margin
- Is competitive but not undercut
- Is realistic for handmade work on Etsy

Return a JSON with:
- suggested_price: the recommended price based on Etsy averages
- reasoning: what similar Etsy items cost

Use real Etsy marketplace pricing data.`;
}

function buildLaborPrompt({ projectName, materialsText, machinesText, sizeText, qtyText }) {
  return `You are an expert Etsy seller and maker estimating realistic production time for custom handmade products.

Project: ${projectName}
Materials: ${materialsText}
Machines: ${machinesText}
${sizeText}
${qtyText}

Based on 2026 Etsy market standards and professional maker experience, estimate realistic time for a SINGLE unit of this item (except design time, which is a one-time cost for the whole batch):
1. Design/planning time (digital design, layout, test cuts) - ONE-TIME for the whole batch, not per unit
2. Manual labor time PER UNIT (assembly, finishing, packaging, quality check)
3. Engrave time PER UNIT - time the selected machine spends engraving/marking one unit, based on the machine's wattage/type if provided
4. Cut time PER UNIT - time the selected machine spends cutting out one unit, based on the machine's wattage/type if provided

Guidelines:
- Small items (under 4 inches): design 10-20min, labor 5-15min/unit, engrave 1-3min/unit, cut 0.5-2min/unit
- Medium items (4-12 inches): design 15-30min, labor 10-25min/unit, engrave 2-6min/unit, cut 1-4min/unit
- Large/complex items (12+ inches): design 30-60min, labor 20-60min/unit, engrave 5-15min/unit, cut 2-10min/unit
- Personalized/custom text adds 1-3min/unit to engrave time
- Packaging and quality check: add 2-5min/unit to labor
- Higher wattage machines cut/engrave faster than lower wattage machines
- Larger batch quantities typically have slightly lower per-unit labor time due to production efficiency

Respond with ONLY a JSON object, no explanation:`;
}

function buildMaterialDetailsPrompt(name, reorderUrl) {
  return reorderUrl
    ? `Visit this product/material page URL and extract the details for inventory tracking: ${reorderUrl}. ${
        name ? `The material is listed as "${name}" if visible. ` : ""
      }Return the material name, category (one of: wood, acrylic, leather, paper, fabric, other), thickness (e.g. "1/8"), sheet width and height in inches, cost per sheet in USD, and the supplier/vendor name. If a field isn't found, return null for it.`
    : `A maker is adding a material to inventory named "${name}". Based on the name, determine the best category (one of: wood, acrylic, leather, paper, fabric, other), a likely thickness (e.g. "1/8", "3mm"), typical sheet width and height in inches, and an estimated cost per sheet in USD. Return only what you can reasonably infer; null for anything uncertain.`;
}

function buildMaterialImagePrompt(name, supplier, category, visualDescription) {
  const supplierDesc = supplier ? ` from ${supplier}` : "";
  const appearance = visualDescription ? ` It looks like: ${visualDescription}.` : "";
  return `A clean, professional product photograph of a single sheet of ${name}${supplierDesc}, a ${category} material used for laser cutting and engraving.${appearance} Studio lighting, plain light background, top-down view, realistic texture and accurate color, no text, no watermark, no people.`;
}

function buildExpenseMatchPrompt(expenses, receipts) {
  return `You are reconciling a maker's business credit card charges against material purchase receipts.
Each "receipt" groups line items from the same vendor on the same date; its "total" is the sum of those line items and should equal the matching charge.
The charge's real merchant is in the "merchant" field (card bank name plus the store), so match it to the receipt vendor when they refer to the same store (e.g. "SP HOUSTON ACRYLIC ..." matches vendor "Houston Acrylic").
Match each charge to at most one receipt, and each receipt to at most one charge.
Match when the merchant refers to the receipt vendor AND the charge date is within 7 days of the receipt date. Totals may differ (shipping/tax), so do not require an exact total — but mention the dollar difference in the note.
If no receipt vendor matches the charge merchant, exclude the charge.

CREDIT CARD CHARGES:
${JSON.stringify(expenses)}

RECEIPTS (grouped by vendor + date):
${JSON.stringify(receipts)}

Return JSON with a "matches" array. Each match has expense_id, receipt_key, and a short note.`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ---- Paid plan AI features ----
    if (action === "price_suggestion") {
      if (!(await canUsePaidAI(base44, user))) {
        return Response.json({ error: "AI price suggestions require the Maker Pro plan." }, { status: 403 });
      }
      const projectName = text(body.projectName) || "Custom item";
      const materialsTotal = Number(body.materialsTotal) || 0;
      const materials = Array.isArray(body.materials) ? body.materials.slice(0, 50) : [];
      const materialsDesc = materials
        .map((m) => text(m?.name || m?.type, 120))
        .filter(Boolean)
        .join(", ") || "Custom item";

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildPricePrompt(projectName, materialsDesc, materialsTotal),
        response_json_schema: {
          type: "object",
          properties: {
            suggested_price: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["suggested_price", "reasoning"],
        },
        add_context_from_internet: true,
      });
      return Response.json(result);
    }

    if (action === "labor_estimate") {
      if (!(await canUsePaidAI(base44, user))) {
        return Response.json({ error: "AI time estimates require the Maker Pro plan." }, { status: 403 });
      }
      const projectName = text(body.projectName) || "Custom handmade item";
      const qty = Number(body.quantity) || 1;
      const machineDetails = Array.isArray(body.machineDetails) ? body.machineDetails.slice(0, 20) : [];
      const machines = Array.isArray(body.machines) ? body.machines.slice(0, 20) : [];
      const materialsText = Array.isArray(body.materials)
        ? body.materials.slice(0, 50).map((m) => `${m?.quantity || 1}x ${text(m?.name || m?.material_type, 120) || "material"}`).join(", ")
        : (text(body.materials, 500) || "None specified");
      const machinesText = machineDetails.length > 0
        ? machineDetails.map((m) => {
            const parts = [m.name || m.model || "machine"];
            if (m.brand || m.model) parts.push(`(${[m.brand, m.model].filter(Boolean).join(" ")})`);
            if (m.wattage) parts.push(`${m.wattage}W`);
            if (m.type) parts.push(m.type);
            return parts.join(" ");
          }).join(", ")
        : machines.length > 0
          ? machines.map((m) => m.name || "machine").join(", ")
          : "Standard laser/CNC equipment";
      const size = text(body.size, 100);
      const sizeUnit = body.sizeUnit === "cm" ? "cm" : "inches";
      const sizeText = size ? `Size/Dimensions: ${size} ${sizeUnit}` : "Size not specified";
      const qtyText = `Batch quantity: ${qty} unit${qty === 1 ? "" : "s"}`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildLaborPrompt({ projectName, materialsText, machinesText, sizeText, qtyText }),
        response_json_schema: {
          type: "object",
          properties: {
            design_hours: { type: "number" },
            design_minutes: { type: "number" },
            labor_hours: { type: "number" },
            labor_minutes: { type: "number" },
            engrave_minutes_per_unit: { type: "number" },
            cut_minutes_per_unit: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["design_hours", "design_minutes", "labor_hours", "labor_minutes", "engrave_minutes_per_unit", "cut_minutes_per_unit"],
        },
      });
      return Response.json(result);
    }

    // ---- Free-tier conveniences: fixed prompts, caller supplies only data ----
    if (action === "material_details") {
      const name = text(body.name);
      const reorderUrl = isHttpUrl(body.reorder_url) ? text(body.reorder_url, 500) : "";
      if (!name && !reorderUrl) {
        return Response.json({ error: "name or reorder_url is required" }, { status: 400 });
      }
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildMaterialDetailsPrompt(name, reorderUrl),
        add_context_from_internet: Boolean(reorderUrl),
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: ["wood", "acrylic", "leather", "paper", "fabric", "other"] },
            thickness: { type: "string" },
            default_width: { type: "number" },
            default_height: { type: "number" },
            cost_per_sheet: { type: "number" },
            supplier: { type: "string" },
          },
        },
      });
      return Response.json(result || {});
    }

    if (action === "material_image") {
      const name = text(body.name);
      if (!name) return Response.json({ error: "name is required" }, { status: 400 });
      const supplier = text(body.supplier);
      const category = text(body.category, 40) || "crafting";
      const reorderUrl = isHttpUrl(body.reorder_url) ? text(body.reorder_url, 500) : "";

      let visualDescription = "";
      if (reorderUrl) {
        try {
          const descRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Visit this product page URL: ${reorderUrl}\nThe product is a crafting/laser material called "${name}". In one or two sentences, describe only its visible appearance for a product photo: color, texture, finish (matte/gloss), thickness look, and sheet form. Do not invent details; if the page is unavailable, return an empty description.`,
            add_context_from_internet: true,
            response_json_schema: {
              type: "object",
              properties: { description: { type: "string" } },
            },
          });
          visualDescription = text(descRes?.description, 600).trim();
        } catch (_e) {
          visualDescription = "";
        }
      }

      const result = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: buildMaterialImagePrompt(name, supplier, category, visualDescription),
      });
      const image_url = result?.url || result?.file_url;
      if (!image_url) {
        return Response.json({ error: "Image generation returned no URL" }, { status: 500 });
      }
      return Response.json({ image_url });
    }

    if (action === "expense_match") {
      const expenses = Array.isArray(body.expenses) ? body.expenses.slice(0, 100) : [];
      const receipts = Array.isArray(body.receipts) ? body.receipts.slice(0, 100) : [];
      if (expenses.length === 0 || receipts.length === 0) {
        return Response.json({ matches: [] });
      }
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildExpenseMatchPrompt(expenses, receipts),
        response_json_schema: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  expense_id: { type: "string" },
                  receipt_key: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
      });
      return Response.json({ matches: Array.isArray(result?.matches) ? result.matches : [] });
    }

    if (action === "chase_statement") {
      const documentId = text(body.document_id, 100);
      if (!documentId) return Response.json({ error: "document_id is required" }, { status: 400 });

      // The caller never supplies a file URL. The document record is read with the
      // USER-scoped client, so RLS only returns documents this user uploaded —
      // any other user's document simply is not found here.
      let document = null;
      try {
        document = await base44.entities.UploadedDocument.get(documentId);
      } catch (_e) {
        document = null;
      }
      if (!document || document.owner_user_id !== user.id) {
        return Response.json({ error: "Document not found" }, { status: 403 });
      }

      // The document lives in private storage; the short-lived signed URL is created
      // here, server-side, and never leaves this function.
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: document.file_uri,
        expires_in: 300,
      });
      if (!signed?.signed_url) {
        return Response.json({ status: "error", details: "Could not open the uploaded file" }, { status: 500 });
      }

      // Schema is fixed here, not caller-supplied, so this cannot be used to pull
      // arbitrary structured data out of an arbitrary file.
      const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: signed.signed_url,
        json_schema: CHASE_SCHEMA,
      });
      return Response.json(extracted || { status: "error", details: "No data returned" });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}