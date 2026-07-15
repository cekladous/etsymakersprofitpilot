import { useAuth } from '@/components/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const PLANS = {
  FREE: 'free',
  MAKER_PRO: 'maker_pro',
  MAKER_PLUS: 'maker_plus'
};

const PLAN_CONFIG = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      monthly_imports: 1,
      reconciliation: false,
      month_close: false,
      csv_exports: false,
      locked_months: false,
      max_users: 1,
      priority_support: false
    }
  },
  maker_plus: {
    name: 'Maker Plus',
    price: 9,
    features: {
      monthly_imports: -1,
      reconciliation: true,
      month_close: true,
      csv_exports: true,
      locked_months: false,
      max_users: 1,
      priority_support: false
    }
  },
  maker_pro: {
    name: 'Maker Pro',
    price: 14,
    features: {
      monthly_imports: -1,
      reconciliation: true,
      month_close: true,
      csv_exports: true,
      locked_months: true,
      max_users: 2,
      priority_support: true
    }
  }
};

export function useFeatureAccess() {
  const { user } = useAuth();

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const subs = await base44.entities.Subscription.filter({
        owner_user_id: user.id
      });
      return subs[0] || null;
    },
    enabled: !!user
  });

  // Authoritative usage count: statement imports created this calendar month.
  const { data: importsThisMonth = 0 } = useQuery({
    queryKey: ['imports-this-month', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const imports = await base44.entities.EtsyStatementImport.filter({
        owner_user_id: user.id
      });
      return imports.filter(i => i.created_date && new Date(i.created_date) >= monthStart).length;
    },
    enabled: !!user
  });

  const isAdmin = user?.role === 'admin';
  // A paid plan only counts when the subscription is genuinely active (or in a Square trial).
  // A subscription period is valid if no end date is set (legacy/comped) or the end date is in the future.
  const periodValid = !subscription?.current_period_end ||
    new Date(subscription.current_period_end) >= new Date();
  const hasActivePaidSub = !!subscription &&
    subscription.plan_id !== PLANS.FREE &&
    ['active', 'trial'].includes(subscription.status) &&
    periodValid;

  const activePlan = hasActivePaidSub ? subscription.plan_id : 'free';
  const planConfig = PLAN_CONFIG[activePlan] || PLAN_CONFIG.free;

  const hasFeature = (feature) => {
    if (isAdmin) return true;
    return planConfig.features[feature] ?? false;
  };

  const canImportEtsy = () => {
    if (isAdmin) return true;
    if (subscription && subscription.status === 'expired') return false;
    const limit = planConfig.features.monthly_imports;
    if (limit === -1) return true;
    return importsThisMonth < limit;
  };

  const canExportCSV = () => hasFeature('csv_exports');
  const canCloseMonth = () => hasFeature('month_close');
  const canLockMonths = () => hasFeature('locked_months');
  const canAddUsers = () => isAdmin || planConfig.features.max_users > 1;
  const canViewReconciliation = () => hasFeature('reconciliation');

  return {
    subscription,
    planConfig,
    importsThisMonth,
    hasFeature,
    canImportEtsy,
    canExportCSV,
    canCloseMonth,
    canLockMonths,
    canAddUsers,
    canViewReconciliation,
    isPaid: hasActivePaidSub,
    isExpired: subscription?.status === 'expired' || (!!subscription?.current_period_end && new Date(subscription.current_period_end) < new Date()),
    isGracePeriod: subscription?.status === 'payment_failed'
  };
}
