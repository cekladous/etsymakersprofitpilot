import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/utils';

const FEATURE_MAP = {
  etsy_import: {
    title: 'Unlimited Imports',
    description: 'You have used your 1 free statement import this month. Upgrade to Maker Plus for unlimited Etsy imports.',
    plan: 'Maker Plus',
    planId: 'maker_plus'
  },
  csv_export: {
    title: 'CSV Export',
    description: 'Export your data to CSV. Available in Maker Plus and Pro.',
    plan: 'Maker Plus',
    planId: 'maker_plus'
  },
  month_close: {
    title: 'Month Close & Audit Trail',
    description: 'Lock months and maintain an audit trail. Available in Maker Plus and Pro.',
    plan: 'Maker Plus',
    planId: 'maker_plus'
  },
  reconciliation: {
    title: 'Full Reconciliation',
    description: 'Match your Etsy statement against orders and deposits, review unmatched rows, and reconcile every penny. Available in Maker Plus and Pro.',
    plan: 'Maker Plus',
    planId: 'maker_plus'
  },
  pro_reports: {
    title: 'Additional Etsy Reports',
    description: 'Import Sold Orders, Payment Deposits, and Payment Account reports. Available in Maker Plus and Pro.',
    plan: 'Maker Plus',
    planId: 'maker_plus'
  },
  team_users: {
    title: 'Add Team Members',
    description: 'Invite an accountant or team member. Maker Pro supports up to 2 users.',
    plan: 'Maker Pro',
    planId: 'maker_pro'
  }
};

const DEFAULT_INFO = {
  title: 'Premium Feature',
  description: 'This feature is available on paid plans. Upgrade to unlock it.',
  plan: 'Maker Plus',
  planId: 'maker_plus'
};

export default function UpgradeCTA({ open, onOpenChange, onClose, feature, currentPlan, inline }) {
  const info = FEATURE_MAP[feature] || DEFAULT_INFO;

  const handleUpgrade = () => {
    window.location.href = createPageUrl('Checkout') + '?plan=' + info.planId;
  };

  const body = (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
        <Lock className="w-6 h-6 text-emerald-700" />
      </div>
      <p className="font-semibold text-stone-800">{info.title}</p>
      <p className="text-sm text-stone-500 max-w-sm">{info.description}</p>
      {currentPlan && (
        <p className="text-xs text-stone-400">Your current plan: {currentPlan}</p>
      )}
      <Button onClick={handleUpgrade} className="mt-2">
        <Sparkles className="w-4 h-4 mr-2" />
        Upgrade to {info.plan}
      </Button>
    </div>
  );

  if (inline) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">{body}</CardContent>
      </Card>
    );
  }

  const handleChange = onOpenChange || ((v) => { if (!v && onClose) onClose(); });

  return (
    <Dialog open={open === undefined ? true : !!open} onOpenChange={handleChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade Required</DialogTitle>
          <DialogDescription>Unlock this feature with a paid plan.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
