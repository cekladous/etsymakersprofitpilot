import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { ensureFreshToken } from "../../shared/squareOauth.ts";
import { syncSquarePayments, todayISO, addDays } from "../../shared/squareSync.ts";

/**
 * Square payment sync.
 *
 * - A signed-in seller syncs their own connection (Settings → "Sync payments now").
 * - An admin may pass { all_users: true } — this is what the hourly scheduled
 *   workflow calls, and what the 2026 backfill uses.
 *
 * Optional body:
 *   begin_date / end_date : "YYYY-MM-DD" window (defaults to the last 10 days)
 *   days                  : shorthand window size
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const allUsers = body.all_users === true;
    if (allUsers && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const endDate = body.end_date || todayISO();
    const days = Math.min(Math.max(Number(body.days) || 10, 1), 400);
    const beginDate = body.begin_date || addDays(endDate, -(days - 1));

    const connections = allUsers
      ? await base44.asServiceRole.entities.SquareConnection.filter({ status: "active" })
      : await base44.asServiceRole.entities.SquareConnection.filter({ owner_user_id: user.id, status: "active" });

    if (!connections || connections.length === 0) {
      return Response.json({
        ok: false,
        reason: "no_connection",
        message: "No connected Square account found.",
        results: [],
      });
    }

    const results = [];
    for (const stored of connections) {
      const summary = {
        owner_user_id: stored.owner_user_id,
        merchant_name: stored.merchant_name || stored.merchant_id || "",
        ok: false,
      };
      try {
        const conn = await ensureFreshToken(base44, stored);
        const stats = await syncSquarePayments(base44, {
          ownerUserId: conn.owner_user_id,
          conn,
          beginDate,
          endDate,
        });
        summary.ok = stats.errors.length === 0;
        summary.stats = stats;
        await base44.asServiceRole.entities.SquareConnection.update(conn.id, {
          last_sync_at: new Date().toISOString(),
          last_imported_count: stats.linked_to_etsy + stats.new_custom_sales + stats.adjustments_created,
          last_error: stats.errors.length ? stats.errors.slice(0, 3).join(" | ") : "",
        });
      } catch (error) {
        summary.error = error.message;
        await base44.asServiceRole.entities.SquareConnection.update(stored.id, {
          last_error: error.message,
        });
      }
      results.push(summary);
    }

    return Response.json({
      ok: results.some((r) => r.ok),
      window: { begin_date: beginDate, end_date: endDate },
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}