import { base44 } from "@/api/base44Client";

// The production job's "Quoted" price follows the invoice total, so production
// and billing never disagree.
export async function syncLinkedJobPrice({ quoteId, total, ownerUserId }) {
  if (!quoteId || !ownerUserId || typeof total !== "number") return;

  const quote = await base44.entities.Quote.get(quoteId).catch(() => null);
  if (!quote) return;

  const jobs = await base44.entities.Job.filter({ owner_user_id: ownerUserId });
  const orderId = quote.converted_to_order_id;
  const matches = jobs.filter(
    (job) =>
      (orderId && (job.order_ids || []).includes(orderId)) ||
      job.job_number === `JOB-${quote.quote_number}`
  );

  await Promise.all(
    matches
      .filter((job) => Math.abs((job.quoted_total_cost || 0) - total) > 0.005)
      .map((job) => base44.entities.Job.update(job.id, { quoted_total_cost: total }))
  );
}