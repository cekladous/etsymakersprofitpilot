import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const planId = searchParams.get('plan') || 'maker_pro';
  
  const planInfo = {
    maker_pro: { name: 'Maker Pro', price: 9 },
    maker_plus: { name: 'Maker Plus', price: 14 }
  };

  const plan = planInfo[planId] || planInfo.maker_pro;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call createSquareSubscription with card details
      const response = await base44.functions.invoke('createSquareSubscription', {
        planId,
        cardName,
        cardNumber,
        expiry,
        cvv
      });

      if (response.data?.success) {
        // Subscription created, redirect to success page
        navigate('/settings?tab=subscription&success=true');
      } else {
        setError(response.data?.error || 'Payment failed');
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
            <p className="text-lg text-emerald-600 font-semibold mt-1">${plan.price}/month</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="John Doe"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Card Number
              </label>
              <Input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Expiry (MM/YY)
                </label>
                <Input
                  type="text"
                  placeholder="12/25"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  CVV
                </label>
                <Input
                  type="text"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </div>
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
                `Pay $${plan.price}/month`
              )}
            </Button>
          </form>

          <p className="text-xs text-stone-500 text-center mt-4">
            Your payment is secure and processed by Square
          </p>
        </CardContent>
      </Card>
    </div>
  );
}