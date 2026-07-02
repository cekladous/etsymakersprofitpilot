import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, Check, Lock } from 'lucide-react';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoValid, setPromoValid] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [discount, setDiscount] = useState(null);

  const planId = searchParams.get('plan') || 'maker_pro';

  const planInfo = {
    maker_pro: { name: 'Maker Pro', price: 9 },
    maker_plus: { name: 'Maker Plus', price: 14 }
  };

  const plan = planInfo[planId] || planInfo.maker_pro;

  const handleValidatePromo = async () => {
    if (!promoCode) return;
    setPromoLoading(true);
    try {
      const response = await base44.functions.invoke('validatePromoCode', {
        code: promoCode,
        planId
      });
      if (response.data?.valid) {
        setPromoValid(true);
        setDiscount(response.data);
        setError('');
      } else {
        setPromoValid(false);
        setDiscount(null);
        setError(response.data?.error || 'Invalid promo code');
      }
    } catch (err) {
      setPromoValid(false);
      setDiscount(null);
      setError(err.message);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call createSquareSubscription - payment is handled by Square's secure checkout
      const response = await base44.functions.invoke('createSquareSubscription', {
        planId,
        promoCode: promoValid ? promoCode : null
      });

      if (response.data?.success) {
        // Apply promo code usage
        if (promoValid) {
          await base44.functions.invoke('applyPromoCode', { code: promoCode });
        }
        // Subscription created, redirect to success page
        navigate('/settings?tab=subscription&success=true');
      } else if (response.data?.checkoutUrl) {
        // Redirect to Square's hosted checkout page
        window.location.href = response.data.checkoutUrl;
      } else {
        setError(response.data?.error || 'Payment setup failed');
      }
    } catch (err) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Complete Your Purchase</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm text-stone-600 mb-2">Plan:</p>
            <p className="text-2xl font-bold text-stone-900">{plan.name}</p>
            {discount?.discount_type === 'free' ? (
              <p className="text-lg text-emerald-600 font-semibold mt-1 line-through opacity-50">${plan.price}/month</p>
            ) : (
              <p className="text-lg text-emerald-600 font-semibold mt-1">${plan.price}/month</p>
            )}
            {discount && (
              <p className="text-lg text-emerald-700 font-bold mt-2">
                {discount.discount_type === 'free' ? 'FREE' :
                 discount.discount_type === 'percentage' ? `${discount.discount_value}% off` :
                 `$${discount.discount_value} off`}
                {' '}for {discount.duration_months} month{discount.duration_months !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="mb-6 flex gap-2">
            <Input
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoValid(false);
              }}
              disabled={promoValid}
              className="flex-1"
            />
            <Button
              type="button"
              variant={promoValid ? 'default' : 'outline'}
              onClick={handleValidatePromo}
              disabled={promoLoading || !promoCode || promoValid}
              className="gap-2"
            >
              {promoLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : promoValid ? (
                <>
                  <Check className="w-4 h-4" />
                  Applied
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-stone-500" />
                <p className="text-sm font-medium text-stone-700">Secure Payment via Square</p>
              </div>
              <p className="text-xs text-stone-500">
                You'll be redirected to Square's secure checkout to enter your payment details.
                Your card information is never stored or transmitted through our servers.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Subscribe — $${plan.price}/month`
              )}
            </Button>
          </form>

          <p className="text-xs text-stone-500 text-center mt-4 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            Payments secured by Square — PCI-DSS compliant
          </p>
        </CardContent>
      </Card>
    </div>
  );
}