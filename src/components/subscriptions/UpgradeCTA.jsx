import React, { useState } from 'react';
import { AlertCircle, Lock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function UpgradeCTA({ open, onOpenChange, feature, currentPlan }) {
  const [loading, setLoading] = useState(false);
  const featureMap = {
    'etsy_import': {
      title: 'Unlimited Imports',
      description: 'Upgrade to Maker Pro to import unlimited Etsy statements.',
      plan: 'Maker Pro'
    },
    'csv_export': {
      title: 'CSV Export',
      description: 'Export your data to CSV. Available in Maker Pro and Plus.',
      plan: 'Maker Pro'
    },
    'month_close': {
      title: 'Month Close & Audit Trail',
      description: 'Lock months and maintain an audit trail. Available in Maker Pro and Plus.',
      plan: 'Maker Pro'
    },
    'team_users': {
      title: 'Add Team Members',
      description: 'Invite an accountant or team member. Maker Plus supports up to 2 users.',
      plan: 'Maker Plus'
    }
  };

  const info = featureMap[feature] || {};

  const handleUpgrade = async () => {
    const planId = info.plan === 'Maker Plus' ? 'maker_plus' : 'maker_pro';
    setLoading(true);
    try {
      const response = await base44.functions.invoke('createSquareCheckout', { planId });
      if (response.data?.checkoutUrl) {
        window.location.href = createPageUrl(response.data.checkoutUrl);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error starting checkout: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <DialogTitle>{info.title}</DialogTitle>
          </div>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 p-6 text-center">
          <p className="text-2xl font-bold text-emerald-900 mb-2">{info.plan}</p>
          <p className="text-sm text-emerald-700 mb-4">Founders Pricing – locked for early makers</p>
          <p className="text-xs text-emerald-600 mb-4">
            Prices will increase as we add features — early makers keep this rate.
          </p>
          <Button 
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Upgrade Now'
            )}
          </Button>
        </Card>

        <div className="text-xs text-stone-500 text-center">
          Current plan: <span className="font-semibold text-stone-700">{currentPlan}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}