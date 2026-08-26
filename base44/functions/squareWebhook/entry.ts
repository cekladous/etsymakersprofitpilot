import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { squareFetch, getConnectionByMerchant } from "../../shared/squareOauth.ts";

export default async function (req) {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await req.text();
    const signature = req.headers.get("x-square-hmac-sha256");
    const webhookSecret = Deno.env.get("SQUARE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("SQUARE_WEBHOOK_SECRET not configured");
      return Response.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // Verify webhook signature using HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const bodyData = encoder.encode(body);
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, bodyData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const computedSignature = btoa(String.fromCharCode.apply(null, signatureArray));

    if (computedSignature !== signature) {
      console.warn("Invalid webhook signature");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const eventType = payload.type || "";
    const merchantId = payload.merchant_id || "";

    const base44 = createClientFromRequest(req);

    // ---- Invoice payment sync (routed per-merchant to the seller who owns it) ----
    // When Square marks an invoice PAID, reflect it in the app: mark the linked
    // invoice Paid and (if no sale is linked yet) create a Custom Sale so the
    // revenue shows up. Idempotent — a replay or already-paid invoice is skipped.
    // Only the seller who owns this Square merchant is affected; the builder's
    // account and other sellers never see each other's data.
    if (eventType.startsWith("invoice.")) {
      const sqInv = payload.data?.object?.invoice || payload.data?.object;
      const squareInvoiceId = sqInv?.id;
      if (!squareInvoiceId) return Response.json({ success: true });

      const conn = await getConnectionByMerchant(base44, merchantId);
      if (!conn) return Response.json({ success: true });

      const fresh = await squareFetch(conn.access_token, `/v2/invoices/${squareInvoiceId}`);
      const inv = fresh && fresh.invoice;
      if (!inv || inv.status !== "PAID") return Response.json({ success: true });

      const matches = await base44.asServiceRole.entities.Invoice.filter({
        square_invoice_id: squareInvoiceId,
      });
      if (!matches || matches.length === 0) return Response.json({ success: true });
      const appInv = matches[0];

      if (appInv.status === "Paid") return Response.json({ success: true });

      const update = {
        status: "Paid",
        amount_paid: Number(appInv.total || 0),
        balance_due: 0,
      };

      if (!appInv.custom_sale_id) {
        const saleDate = appInv.invoice_date || new Date().toISOString().split("T")[0];
        const customSale = await base44.asServiceRole.entities.CustomSale.create({
          owner_user_id: appInv.owner_user_id,
          date: saleDate,
          vendor: appInv.customer_name || "",
          description: `${appInv.project_name || "Invoice"} — ${appInv.invoice_number || ""}`,
          payment_source: appInv.payment_method || "Square",
          pre_tax_amount: Number(appInv.subtotal || 0),
          sales_tax_collected: Number(appInv.tax_amount || 0),
          gross_sale: Number(appInv.total || 0),
          shipping_or_postage_cost: Number(appInv.shipping_cost || 0),
          notes: `Auto-created from Square-paid invoice ${appInv.invoice_number || ""}`,
        });
        update.custom_sale_id = customSale.id;
      }

      await base44.asServiceRole.entities.Invoice.update(appInv.id, update);
      console.log(`Invoice ${appInv.id} marked Paid from Square webhook (merchant ${merchantId})`);
      return Response.json({ success: true });
    }

    // ---- Subscription sync (builder SaaS billing) ----
    const squareSubscriptionId = payload.data?.object?.subscription?.id;
    if (!squareSubscriptionId) {
      return Response.json({ success: true }, { status: 200 });
    }

    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({
      square_subscription_id: squareSubscriptionId,
    });

    if (subscriptions.length === 0) {
      console.warn(`No subscription found for Square ID: ${squareSubscriptionId}`);
      return Response.json({ success: true }, { status: 200 });
    }

    const subscription = subscriptions[0];
    const squareData = payload.data?.object?.subscription;

    let updateData = {};
    if (eventType === "subscription.created") {
      updateData = {
        status: "active",
        square_subscription_id: squareSubscriptionId,
        current_period_start: squareData.start_date,
        current_period_end: squareData.billing_anchor_date,
      };
    } else if (eventType === "subscription.updated") {
      const squareStatus = squareData.state;
      if (squareStatus === "ACTIVE") {
        updateData = {
          status: "active",
          current_period_start: squareData.start_date,
          current_period_end: squareData.billing_anchor_date,
          grace_period_end: null,
        };
      } else if (squareStatus === "CANCELED") {
        updateData = { status: "canceled", canceled_at: new Date().toISOString() };
      }
      if (squareData.payment_method?.card?.card_status === "FAILED") {
        updateData = {
          status: "payment_failed",
          grace_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        };
      }
    } else if (eventType === "subscription.deleted") {
      updateData = { status: "canceled", canceled_at: new Date().toISOString() };
    }

    if (Object.keys(updateData).length > 0) {
      if (updateData.status && subscription.status === updateData.status) {
        console.log(`Subscription ${subscription.id} already ${updateData.status}, skipping duplicate webhook`);
        return Response.json({ success: true }, { status: 200 });
      }
      await base44.asServiceRole.entities.Subscription.update(subscription.id, updateData);
      console.log(`Updated subscription ${subscription.id}:`, updateData);
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}