import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { getEntitlements } from "../../shared/subscriptionGuard.ts";

// Authoritative quote creation: enforces the plan's monthly quote quota on the
// server so the client-side check is UX only. Writes with the service role so
// the caller's ownership is set from the verified session, not the payload.

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const draft = body && body.quote;
    if (!draft || typeof draft !== 'object' || !draft.quote_number || !draft.project_name || !draft.customer_name) {
      return Response.json(
        { error: 'A quote with quote_number, project_name and customer_name is required' },
        { status: 400 },
      );
    }

    const { features, subscription, plan } = await getEntitlements(base44, user);
    const limit = features.quotesPerMonth;
    let usedThisMonth = 0;

    if (limit !== -1) {
      const { items } = await base44.asServiceRole.entities.Quote.filter(
        { owner_user_id: user.id, created_date: { $gte: monthStartIso() } },
        { limit },
      );
      usedThisMonth = (items || []).length;
      if (usedThisMonth >= limit) {
        return Response.json({ error: 'quote_limit_reached', limit, plan }, { status: 403 });
      }
    }

    const { id, created_by_id, created_date, updated_date, ...fields } = draft;
    const created = await base44.asServiceRole.entities.Quote.create({
      ...fields,
      owner_user_id: user.id,
    });

    // Keep the stored usage counter in step with the enforced count (best effort).
    if (subscription && limit !== -1) {
      await base44.asServiceRole.entities.Subscription
        .update(subscription.id, { quotes_used_this_month: usedThisMonth + 1 })
        .catch(() => {});
    }

    return Response.json({ quote: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}