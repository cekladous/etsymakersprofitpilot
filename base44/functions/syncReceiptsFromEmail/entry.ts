import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const GMAIL_ID = "6a90536b527c34d0e2918006";
const OUTLOOK_ID = "6a9053754cf3bedc66182209";

const RECEIPT_KEYWORDS = [
  "receipt", "order confirmation", "invoice", "purchase",
  "thank you for your order", "your order", "payment receipt",
  "order receipt", "order #", "receipt for your payment"
];

function b64decode(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function extractGmailBody(payload) {
  let text = "";
  let html = "";
  function walk(part) {
    if (!part) return;
    if (part.body && part.body.data) {
      const decoded = b64decode(part.body.data);
      if (part.mimeType === "text/plain" && !text) text = decoded;
      else if (part.mimeType === "text/html" && !html) html = decoded;
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  // strip html tags crudely for the LLM
  const plain = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "");
  return plain.slice(0, 9000);
}

function headerValue(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function senderDomain(fromHeader) {
  const m = /<([^>]+)>/.exec(fromHeader) || [fromHeader, fromHeader];
  const email = (m[1] || m[0] || "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : email;
}

function matchesSupplier(senderEmail, senderDom, allowList) {
  if (!allowList || allowList.length === 0) return false;
  const e = (senderEmail || "").toLowerCase();
  const d = (senderDom || "").toLowerCase();
  return allowList.some((s) => {
    const v = (s.match_value || "").toLowerCase().trim();
    if (!v) return false;
    if (v.includes("@")) return e === v || e.endsWith("@" + v.split("@").pop());
    return d === v || d.endsWith("." + v) || e.includes(v);
  });
}

function hasKeyword(text) {
  const t = (text || "").toLowerCase();
  return RECEIPT_KEYWORDS.some((k) => t.includes(k));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const provider = body.provider; // "gmail" | "outlook"
    const connectorId = body.connectorId || (provider === "gmail" ? GMAIL_ID : OUTLOOK_ID);
    const dryRun = !!body.dryRun;
    const maxMessages = 15;

    if (!provider || !connectorId) {
      return Response.json({ error: 'provider and connectorId are required' }, { status: 400 });
    }

    // Connection check (dry run) — doubles as the frontend's status probe.
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({ connected: false, provider, reason: 'not_connected' });
    }
    if (dryRun) {
      return Response.json({ connected: true, provider });
    }

    // Load sync state (per user + provider)
    const states = await base44.entities.EmailSyncState.filter(
      { owner_user_id: user.id, provider }, "-last_sync_at", 1
    );
    let state = states[0];
    const sevenDaysAgoUnix = Math.floor(Date.now() / 1000) - 7 * 86400;
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();
    const sinceUnix = state?.last_sync_at ? Math.floor(new Date(state.last_sync_at).getTime() / 1000) : sevenDaysAgoUnix;
    const sinceIso = state?.last_sync_at ? new Date(state.last_sync_at).toISOString() : sevenDaysAgoIso;
    const processed = new Set((state?.processed_message_ids || []).slice(-500));

    // Load allow-list
    const allowList = await base44.entities.ReceiptSupplier.filter(
      { owner_user_id: user.id }, "-created_date", 200
    );

    let candidates = [];
    if (provider === "gmail") {
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${sinceUnix}&maxResults=${maxMessages}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!listRes.ok) {
        const errText = await listRes.text();
        return Response.json({ error: `Gmail list failed: ${listRes.status} ${errText}` }, { status: 502 });
      }
      const listJson = await listRes.json();
      const ids = (listJson.messages || []).map((m) => m.id).filter((id) => !processed.has(id));
      for (const id of ids) {
        const mRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!mRes.ok) continue;
        const msg = await mRes.json();
        const from = headerValue(msg.payload?.headers, "From");
        const subject = headerValue(msg.payload?.headers, "Subject");
        const bodyText = extractGmailBody(msg.payload);
        candidates.push({ id, from, subject, body: bodyText, date: headerValue(msg.payload?.headers, "Date") });
      }
    } else {
      const listRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${sinceIso}&$top=${maxMessages}&$select=id,subject,from,body,hasAttachments,receivedDateTime`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!listRes.ok) {
        const errText = await listRes.text();
        return Response.json({ error: `Outlook list failed: ${listRes.status} ${errText}` }, { status: 502 });
      }
      const listJson = await listRes.json();
      for (const msg of (listJson.value || [])) {
        if (processed.has(msg.id)) continue;
        const html = (msg.body && msg.body.content) || "";
        const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 9000);
        candidates.push({
          id: msg.id,
          from: msg.from?.emailAddress?.address || "",
          subject: msg.subject || "",
          body: text,
          date: msg.receivedDateTime || ""
        });
      }
    }

    let imported = 0;
    let skippedNotReceipt = 0;
    let skippedFiltered = 0;
    const newProcessedIds = [];

    for (const c of candidates) {
      newProcessedIds.push(c.id);
      const dom = senderDomain(c.from);
      const inAllowList = matchesSupplier(c.from, dom, allowList);
      const keywordHit = hasKeyword(c.subject) || hasKeyword(c.body);
      // known-suppliers OR keyword; AI review confirms either way
      if (!inAllowList && !keywordHit) { skippedFiltered++; continue; }

      const prompt = `You are a receipt parser. Determine whether this email is a genuine purchase receipt / order confirmation (not a newsletter, shipping-only update, marketing, or personal message). If it is a receipt, extract the purchase details.

Email subject: ${c.subject}
Sender: ${c.from}
Email body:
${c.body}

Return JSON with: is_receipt (boolean), vendor (string), purchase_date (YYYY-MM-DD), total (number, USD), line_items (array of {name, quantity (number), unit_cost (number), total (number)}), payment_method (string), notes (string). If not a receipt, set is_receipt=false and leave others empty.`;

      let parsed;
      try {
        const llmRes = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              is_receipt: { type: "boolean" },
              vendor: { type: "string" },
              purchase_date: { type: "string" },
              total: { type: "number" },
              line_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "number" },
                    unit_cost: { type: "number" },
                    total: { type: "number" }
                  }
                }
              },
              payment_method: { type: "string" },
              notes: { type: "string" }
            },
            required: ["is_receipt", "vendor", "total", "line_items"]
          }
        });
        parsed = llmRes;
      } catch (e) {
        continue;
      }

      if (!parsed || parsed.is_receipt === false) { skippedNotReceipt++; continue; }
      const vendor = (parsed.vendor || c.from || "Supplier").toString().slice(0, 120);
      const pdate = (parsed.purchase_date || new Date().toISOString().split("T")[0]).slice(0, 10);
      const paymentMethod = (parsed.payment_method || "").toString().slice(0, 60);
      const lineItems = Array.isArray(parsed.line_items) ? parsed.line_items : [];
      const sourceNote = `Auto-imported from email: ${c.subject || "(no subject)"} [${provider}]`;

      const records = [];
      if (lineItems.length > 0) {
        for (const li of lineItems) {
          const name = (li.name || vendor || "Material").toString().slice(0, 120);
          const qty = Number(li.quantity) || 1;
          const total = Number(li.total) || 0;
          const unit = qty > 0 ? total / qty : total;
          if (!name || total <= 0) continue;
          records.push({ material_name: name, vendor, quantity: qty, unit_cost: unit, total_cost: total });
        }
      } else if (Number(parsed.total) > 0) {
        records.push({ material_name: vendor, vendor, quantity: 1, unit_cost: Number(parsed.total), total_cost: Number(parsed.total) });
      }

      for (const r of records) {
        const purchase = await base44.entities.MaterialPurchase.create({
          owner_user_id: user.id,
          purchase_date: pdate,
          material_name: r.material_name,
          vendor: r.vendor,
          quantity: r.quantity,
          unit_cost: r.unit_cost,
          total_cost: r.total_cost,
          payment_method: paymentMethod || undefined,
          notes: sourceNote
        });

        // Update inventory item (weighted average cost) + transaction, scoped to user
        const existing = await base44.entities.InventoryItem.filter(
          { material_name: r.material_name, owner_user_id: user.id }, "-last_updated", 1
        );
        let invId;
        if (existing.length > 0) {
          const it = existing[0];
          const oldQty = it.quantity_on_hand || 0;
          const oldAvg = it.average_cost || 0;
          const newQty = oldQty + r.quantity;
          const newAvg = newQty > 0 ? (oldQty * oldAvg + r.quantity * r.unit_cost) / newQty : r.unit_cost;
          await base44.entities.InventoryItem.update(it.id, {
            quantity_on_hand: newQty,
            average_cost: newAvg,
            total_value: newQty * newAvg,
            last_updated: new Date().toISOString()
          });
          invId = it.id;
        } else {
          const created = await base44.entities.InventoryItem.create({
            owner_user_id: user.id,
            material_name: r.material_name,
            quantity_on_hand: r.quantity,
            average_cost: r.unit_cost,
            total_value: r.total_cost,
            last_updated: new Date().toISOString()
          });
          invId = created.id;
        }
        await base44.entities.InventoryTransaction.create({
          owner_user_id: user.id,
          inventory_item_id: invId,
          transaction_date: pdate,
          transaction_type: "purchase",
          quantity_change: r.quantity,
          unit_cost: r.unit_cost,
          reference_id: purchase.id,
          notes: `Email import — ${r.vendor}`
        });
        imported++;
      }
    }

    // Persist sync state
    const nowIso = new Date().toISOString();
    const mergedIds = [...(state?.processed_message_ids || []), ...newProcessedIds].slice(-500);
    if (state) {
      await base44.entities.EmailSyncState.update(state.id, {
        last_sync_at: nowIso,
        processed_message_ids: mergedIds,
        last_status: "success",
        last_error: "",
        last_imported_count: imported
      });
    } else {
      await base44.entities.EmailSyncState.create({
        owner_user_id: user.id,
        provider,
        last_sync_at: nowIso,
        processed_message_ids: mergedIds,
        last_status: "success",
        last_error: "",
        last_imported_count: imported
      });
    }

    return Response.json({
      connected: true,
      provider,
      scanned: candidates.length,
      imported,
      skipped_not_receipt: skippedNotReceipt,
      skipped_filtered: skippedFiltered
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}