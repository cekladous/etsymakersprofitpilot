import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, Check, Lock } from 'lucide-react';
import { createPageUrl } from '@/utils';

const PLAN_INFO = {
  maker_plus: { name: 'Maker Plus', price: 9 },
  maker_pro: { name: 'Maker Pro', price: 14 }
};

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [success, setSuccess] = useState(false);

  const urlPlan = searchParams.get('plan') || 'maker_plus';
  const planId = appliedPromo?.plan_id && PLAN_INFO[appliedPromo.plan_id]
    ? appliedPromo.plan_id
    : (PLAN_INFO[urlPlan] ? urlPlan : 'maker_plus');
  const plan = PLAN_INFO[planId];
  const isFreePromo = !!appliedPromo && appliedPromo.discount_type === 'free';

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setError('');
    try {
      const codes = await base44.entities.PromoCode.filter({ code: promoCode.toUpperCase().trim() });
      const promo = codes[0];
      if (!promo) { setAppliedPromo(null); setError('Promo code not found'); return; }
      if (promo.is_active === false) { setAppliedPromo(null); setError('This promo code is no longer active'); return; }
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) { setAppliedPromo(null); setError('This promo code has expired'); return; }
      if (promo.max_uses != null && promo.max_uses !== -1 && (promo.current_uses || 0) >= promo.max_uses) {
        setAppliedPromo(null); setError('This promo code has reached its usage limit'); return;
      }
      setAppliedPromo(promo);
    } catch (err) {
      console.error('Promo validation error:', err);
      setError('Could not validate promo code. Please try again.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRedeemFree = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      const grantPlan = appliedPromo.plan_id || planId;
      const existing = await base44.entities.Subscription.filter({ owner_user_id: user.id });
      const payload = {
        plan_id: grantPlan,
        status: 'active',
        founders_pricing: true,
        billing_notes: 'Promo code ' + appliedPromo.code + ' redeemed ' + new Date().toISOString().slice(0, 10)
      };
      if (existing[0]) {
        await base44.entities.Subscription.update(existing[0].id, payload);
      } else {
        await base44.entities.Subscription.create({ owner_user_id: user.id, ...payload });
      }
      // Best-effort usage counter bump (admin-managed field; ignore failures).
      try {
        await base44.entities.PromoCode.update(appliedPromo.id, { current_uses: (appliedPromo.current_uses || 0) + 1 });
      } catch (e) { /* counter update requires admin; safe to skip */ }
      setSuccess(true);
      setTimeout(() => navigate(createPageUrl('Settings') + '?tab=subscription&success=true'), 1500);
    } catch (err) {
      console.error('Redemption error:', err);
      setError('Could not activate your plan. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900">You're all set!</h2>
            <p className="text-sm text-stone-600">{plan.name} is now active on your account.</p>
            <p className="text-xs text-stone-400">Taking you to your subscription settings…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900 text-center">Complete Your Purchase</h2>

          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs text-stone-500">Plan:</p>
            <p className="text-2xl font-bold text-stone-900">{plan.name}</p>
            {isFreePromo ? (
              <p className="text-emerald-700 font-semibold">
                <span className="line-through text-stone-400 mr-2">${plan.price}/month</span>
                FREE with code {appliedPromo.code}
              </p>
            ) : (
              <p className="text-emerald-700 font-semibold">${plan.price}/month</p>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              disabled={promoLoading || isFreePromo}
            />
            <Button variant="outline" onClick={handleValidatePromo} disabled={promoLoading || isFreePromo || !promoCode.trim()}>
              {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>

          {appliedPromo && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-md p-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Code {appliedPromo.code} applied — {appliedPromo.description || (plan.name + ' free')}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md p-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isFreePromo ? (
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleRedeemFree} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Activate {plan.name} — Free
            </Button>
          ) : (
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-4 text-center space-y-1">
              <p className="text-sm font-medium text-stone-700 flex items-center justify-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Card checkout coming soon
              </p>
              <p className="text-xs text-stone-500">
                Online card payments are not available yet. If you have a promo code, apply it above to activate your plan instantly.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
