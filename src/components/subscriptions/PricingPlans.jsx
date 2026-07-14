import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Zap, ArrowDown, Loader2, AlertCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      'Import 1 Etsy statement/month',
      'Dashboard preview',
      'Read-only access'
    ],
    cta: 'Free',
    popular: false
  },
  {
    id: 'maker_plus',
    name: 'Maker Plus',
    price: 9,
    features: [
      'Unlimited Etsy imports',
      'Full reconciliation',
      'Month close & audit trail',
      'CSV exports',
      'Cashflow reconciliation',
      'Refund conflict detection'
    ],
    cta: 'Get Founders Pricing',
    popular: true,
    label: 'Founders Pricing'
  },
  {
    id: 'maker_pro',
    name: 'Maker Pro',
    price: 14,
    features: [
      'Everything in Maker Plus',
      'Up to 2 users',
      'Locked months protection',
      'Priority imports',
      'Admin reopen with audit',
      'Team collaboration'
    ],
    cta: 'Get Founders Pricing',
    popular: false,
    label: 'Founders Pricing'
  }
];

const TIER_RANK = { free: 0, maker_plus: 1, maker_pro: 2 };

// Features the user gives up when moving down between specific tiers.
const DOWNGRADE_LOSSES = {
  'maker_pro>maker_plus': ['Up to 2 users', 'Locked months protection', 'Priority imports', 'Admin reopen with audit', 'Team collaboration'],
  'maker_pro>free': ['Unlimited Etsy imports (back to 1/month)', 'Full reconciliation', 'Month close & audit trail', 'CSV exports', 'Team features & locked months'],
  'maker_plus>free': ['Unlimited Etsy imports (back to 1/month)', 'Full reconciliation', 'Month close & audit trail', 'CSV exports']
};

export default function PricingPlans({ currentPlan }) {
  const [downgradeTarget, setDowngradeTarget] = useState(null);
  const [downgrading, setDowngrading] = useState(false);
  const [error, setError] = useState('');

  const currentId = currentPlan?.plan_id || 'free';
  const currentName = (PLANS.find(p => p.id === currentId) || PLANS[0]).name;

  const handleUpgrade = (planId) => {
    window.location.href = createPageUrl('Checkout') + '?plan=' + planId;
  };

  const handleDowngrade = async () => {
    if (!downgradeTarget) return;
    setDowngrading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      const existing = await base44.entities.Subscription.filter({ owner_user_id: user.id });
      const payload = {
        plan_id: downgradeTarget.id,
        status: 'active',
        billing_notes: 'Downgraded from ' + currentName + ' to ' + downgradeTarget.name + ' on ' + new Date().toISOString().slice(0, 10)
      };
      if (existing[0]) {
        await base44.entities.Subscription.update(existing[0].id, payload);
      } else {
        await base44.entities.Subscription.create({ owner_user_id: user.id, ...payload });
      }
      window.location.reload();
    } catch (err) {
      console.error('Downgrade error:', err);
      setError('Could not change your plan. Please try again or contact support.');
      setDowngrading(false);
    }
  };

  const losses = downgradeTarget ? (DOWNGRADE_LOSSES[currentId + '>' + downgradeTarget.id] || []) : [];

  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Simple, Maker-Friendly Pricing</h2>
        <p className="text-stone-600">
          Prices will increase as we add features — early makers keep these rates forever.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentId;
          const isUpgrade = (TIER_RANK[plan.id] ?? 0) > (TIER_RANK[currentId] ?? 0);
          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col transition-all ${
                plan.popular && isUpgrade ? 'ring-2 ring-emerald-500 shadow-lg md:scale-105' : ''
              } ${isCurrent ? 'ring-2 ring-stone-400' : ''}`}
            >
              {plan.popular && isUpgrade && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                {plan.label && (
                  <p className="text-xs text-emerald-600 font-medium mt-1">{plan.label}</p>
                )}
                <div className="mt-4">
                  <span className="text-4xl font-bold text-stone-900">${plan.price}</span>
                  {plan.price > 0 && <span className="text-stone-600">/month</span>}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-stone-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {isCurrent ? (
                  <Button disabled className="w-full bg-stone-600 text-white disabled:opacity-60">
                    Current Plan
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    className={`w-full ${
                      plan.popular ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-stone-600 hover:bg-stone-700'
                    } text-white`}
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setDowngradeTarget(plan)}
                    className="w-full text-stone-600 hover:text-stone-800"
                  >
                    <ArrowDown className="w-4 h-4 mr-2" />
                    Downgrade to {plan.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!downgradeTarget} onOpenChange={(v) => { if (!v && !downgrading) { setDowngradeTarget(null); setError(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Downgrade to {downgradeTarget?.name}?</DialogTitle>
            <DialogDescription>
              Your plan will change immediately. You can upgrade again at any time.
            </DialogDescription>
          </DialogHeader>

          {losses.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">You'll lose access to:</p>
              <ul className="space-y-1">
                {losses.map((item, idx) => (
                  <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-stone-500">
            Your data is never deleted — reports and imports you've already made stay on your account.
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md p-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDowngradeTarget(null); setError(''); }} disabled={downgrading}>
              Keep {currentName}
            </Button>
            <Button onClick={handleDowngrade} disabled={downgrading} className="bg-stone-700 hover:bg-stone-800 text-white">
              {downgrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Downgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
