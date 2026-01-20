import React from "react";
import { AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";

export default function GracePeriodWarning({ subscription }) {
  if (!subscription || subscription.status !== 'payment_failed') {
    return null;
  }

  const gracePeriodEnd = subscription.grace_period_end ? parseISO(subscription.grace_period_end) : null;
  const daysLeft = gracePeriodEnd ? Math.ceil((gracePeriodEnd - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <Card className="border-amber-300 bg-amber-50 p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">Payment Failed</h3>
          <p className="text-sm text-amber-800 mt-1">
            Your payment couldn't be processed. You have <strong>{daysLeft} days</strong> to update your payment method.
          </p>
          {gracePeriodEnd && (
            <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Grace period expires: {format(gracePeriodEnd, 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <Button 
          size="sm" 
          onClick={() => window.location.href = '/Settings?tab=subscription'}
          className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
        >
          Update Payment
        </Button>
      </div>
    </Card>
  );
}