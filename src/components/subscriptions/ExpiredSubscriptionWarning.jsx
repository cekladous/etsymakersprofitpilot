import React from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ExpiredSubscriptionWarning({ subscription }) {
  if (!subscription || subscription.status !== 'expired') {
    return null;
  }

  return (
    <Card className="border-red-300 bg-red-50 p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">Subscription Expired</h3>
          <p className="text-sm text-red-800 mt-1">
            Your subscription has expired. Renew now to restore access to all features.
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={() => window.location.href = '/Settings?tab=subscription'}
          className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
        >
          Renew Subscription
        </Button>
      </div>
    </Card>
  );
}