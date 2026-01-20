import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle } from 'lucide-react';
import { PLAN_CONFIG, formatRenewalDate } from '@/components/shared/subscriptionHelper';

export default function SubscriptionStatus({ subscription }) {
  if (!subscription) return null;

  const planConfig = PLAN_CONFIG[subscription.plan_id];
  const isExpired = subscription.status === 'expired';
  const isGracePeriod = subscription.status === 'payment_failed';

  return (
    <div className="space-y-4">
      {/* Current Plan Card */}
      <Card className="bg-gradient-to-br from-stone-50 to-stone-100 border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Your Plan</CardTitle>
            <Badge className={
              isExpired ? 'bg-red-100 text-red-800' :
              isGracePeriod ? 'bg-amber-100 text-amber-800' :
              subscription.plan_id === 'free' ? 'bg-stone-100 text-stone-800' :
              'bg-emerald-100 text-emerald-800'
            }>
              {isExpired ? 'Expired' : isGracePeriod ? 'Payment Failed' : subscription.plan_id === 'free' ? 'Free' : 'Active'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide">Plan</p>
              <p className="text-lg font-bold text-stone-900">{planConfig?.name}</p>
              {subscription.founders_pricing && (
                <p className="text-xs text-emerald-600 font-medium mt-1">Founders Pricing</p>
              )}
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide">Price</p>
              <p className="text-lg font-bold text-stone-900">${planConfig?.price}/mo</p>
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide">Renewal Date</p>
              <p className="text-lg font-bold text-stone-900">{formatRenewalDate(subscription.current_period_end)}</p>
            </div>
          </div>

          {isGracePeriod && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700">
                <p className="font-semibold mb-1">Payment Failed</p>
                <p>Please update your payment method. You have until {formatRenewalDate(subscription.grace_period_end)} before access is limited.</p>
              </div>
            </div>
          )}

          {isExpired && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-semibold mb-1">Subscription Expired</p>
                <p>Your data is safe, but you're in read-only mode. Renew your subscription to continue.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Included Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            <div className={`flex items-start gap-2 ${!planConfig?.reconciliation ? 'opacity-50' : ''}`}>
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${planConfig?.reconciliation ? 'text-emerald-600' : 'text-stone-300'}`} />
              <span className="text-sm text-stone-700">Full Reconciliation</span>
            </div>
            <div className={`flex items-start gap-2 ${!planConfig?.month_close ? 'opacity-50' : ''}`}>
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${planConfig?.month_close ? 'text-emerald-600' : 'text-stone-300'}`} />
              <span className="text-sm text-stone-700">Month Close & Audit</span>
            </div>
            <div className={`flex items-start gap-2 ${planConfig?.monthly_imports === -1 ? '' : 'opacity-50'}`}>
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${planConfig?.monthly_imports === -1 ? 'text-emerald-600' : 'text-stone-300'}`} />
              <span className="text-sm text-stone-700">
                {planConfig?.monthly_imports === -1 ? 'Unlimited' : `${planConfig?.monthly_imports}`} Etsy Imports
              </span>
            </div>
            <div className={`flex items-start gap-2 ${!planConfig?.csv_exports ? 'opacity-50' : ''}`}>
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${planConfig?.csv_exports ? 'text-emerald-600' : 'text-stone-300'}`} />
              <span className="text-sm text-stone-700">CSV Exports</span>
            </div>
            <div className={`flex items-start gap-2 ${planConfig?.max_users < 2 ? 'opacity-50' : ''}`}>
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${planConfig?.max_users > 1 ? 'text-emerald-600' : 'text-stone-300'}`} />
              <span className="text-sm text-stone-700">{planConfig?.max_users} User{planConfig?.max_users > 1 ? 's' : ''}</span>
            </div>
            <div className={`flex items-start gap-2 ${!planConfig?.locked_months ? 'opacity-50' : ''}`}>
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${planConfig?.locked_months ? 'text-emerald-600' : 'text-stone-300'}`} />
              <span className="text-sm text-stone-700">Locked Months</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Message */}
      {subscription.founders_pricing && subscription.plan_id !== 'free' && (
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="pt-6">
            <p className="text-sm text-emerald-900 text-center">
              <span className="font-semibold">Founders Pricing</span> — Prices will increase as we add features. Early makers keep this rate locked in forever. 🎯
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}