import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Zap } from 'lucide-react';
import { createPageUrl } from '@/utils';

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
    cta: 'Current Plan',
    popular: false
  },
  {
    id: 'maker_pro',
    name: 'Maker Pro',
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
    id: 'maker_plus',
    name: 'Maker Plus',
    price: 14,
    features: [
      'Everything in Maker Pro',
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

export default function PricingPlans({ currentPlan, onSelectPlan }) {
  const [loading, setLoading] = useState(null);

  const handleSelectPlan = (planId) => {
    if (planId === 'free' || planId === currentPlan?.plan_id) return;
    // Navigate straight to the in-app checkout — no backend function needed.
    window.location.href = createPageUrl('Checkout') + '?plan=' + planId;
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Simple, Maker-Friendly Pricing</h2>
        <p className="text-stone-600">
          Prices will increase as we add features — early makers keep these rates forever.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <Card 
            key={plan.id}
            className={`relative flex flex-col transition-all ${
              plan.popular ? 'ring-2 ring-emerald-500 shadow-lg md:scale-105' : ''
            } ${currentPlan?.plan_id === plan.id ? 'ring-2 ring-stone-400' : ''}`}
          >
            {plan.popular && (
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

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading === plan.id || plan.id === currentPlan?.plan_id}
                className={`w-full ${
                  plan.popular
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-stone-600 hover:bg-stone-700'
                } text-white`}
              >
                {loading === plan.id ? 'Processing...' : plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}