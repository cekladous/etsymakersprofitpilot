import { useAuth } from '@/components/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PLAN_CONFIG, PLANS } from '@/components/shared/subscriptionHelper.js';

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

  const planConfig = subscription ? PLAN_CONFIG[subscription.plan_id] : PLAN_CONFIG[PLANS.FREE];

  const hasFeature = (feature) => {
    if (!subscription || subscription.status === 'expired') {
      return PLAN_CONFIG[PLANS.FREE][feature] ?? false;
    }
    return planConfig[feature] ?? false;
  };

  const canImportEtsy = () => {
    if (!subscription) return false;
    if (subscription.plan_id === PLANS.FREE) {
      return subscription.imports_used_this_month < 1;
    }
    return true; // Pro and Plus have unlimited
  };

  const canExportCSV = () => hasFeature('csv_exports');
  const canCloseMonth = () => hasFeature('month_close');
  const canLockMonths = () => hasFeature('locked_months');
  const canAddUsers = () => hasFeature('max_users') > 1;

  return {
    subscription,
    planConfig,
    hasFeature,
    canImportEtsy,
    canExportCSV,
    canCloseMonth,
    canLockMonths,
    canAddUsers,
    isPaid: subscription?.plan_id !== PLANS.FREE && subscription?.status === 'active',
    isExpired: subscription?.status === 'expired',
    isGracePeriod: subscription?.status === 'payment_failed'
  };
}