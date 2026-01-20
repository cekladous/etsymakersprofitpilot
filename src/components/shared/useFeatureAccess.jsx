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

  const activePlan = subscription?.plan_id || 'free';
  const planConfig = PLAN_CONFIG[activePlan];
  const isExpiredOrNoSub = !subscription || subscription.status === 'expired';

  const hasFeature = (feature) => {
    const config = isExpiredOrNoSub ? PLAN_CONFIG.free : planConfig;
    return config.features[feature] ?? false;
  };

  const canImportEtsy = () => {
    if (isExpiredOrNoSub) return false;
    if (activePlan === 'free') {
      return (subscription?.imports_used_this_month || 0) < 1;
    }
    return true;
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