// Server-side mirror of the plan gates in src/components/shared/useFeatureAccess.jsx.
// Client-side checks are UX only — these are the authoritative enforcement points
// for operations that run inside backend functions.

export const PLAN_FEATURES = {
  free: {
    monthly_imports: 1,
    quotesPerMonth: 5,
    aiEstimator: false,
    reportCsvExport: false,
    reportMonths: 3,
  },
  maker_plus: {
    monthly_imports: -1,
    quotesPerMonth: -1,
    aiEstimator: false,
    reportCsvExport: false,
    reportMonths: 12,
  },
  maker_pro: {
    monthly_imports: -1,
    quotesPerMonth: -1,
    aiEstimator: true,
    reportCsvExport: true,
    reportMonths: -1,
  },
};

// Resolve the caller's effective plan from the stored Subscription record.
// Admins bypass plan limits (matching the client behavior).
export async function getEntitlements(base44, user) {
  if (!user) {
    return { admin: false, plan: "free", features: PLAN_FEATURES.free, subscription: null };
  }
  if (user.role === "admin") {
    return { admin: true, plan: "admin", features: PLAN_FEATURES.maker_pro, subscription: null };
  }

  const subs = await base44.asServiceRole.entities.Subscription.filter({
    owner_user_id: user.id,
  });
  const subscription = (subs && subs[0]) || null;

  const periodValid = !subscription?.current_period_end
    || new Date(subscription.current_period_end) >= new Date();
  const activePaid = !!subscription
    && subscription.plan_id !== "free"
    && ["active", "trial"].includes(subscription.status)
    && periodValid;

  const plan = activePaid ? subscription.plan_id : "free";
  return {
    admin: false,
    plan,
    features: PLAN_FEATURES[plan] || PLAN_FEATURES.free,
    subscription,
  };
}

// Earliest date the plan may report on. null = unlimited history.
export function reportRangeStart(features) {
  if (features.reportMonths === -1) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - features.reportMonths);
  d.setHours(0, 0, 0, 0);
  return d;
}