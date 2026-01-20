import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, CreditCard, Zap } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useFeatureAccess } from "@/components/shared/useFeatureAccess";

// Import tool components
import SettingsTool from "@/components/tools/SettingsTool";
import PaymentSettingsTool from "@/components/tools/PaymentSettingsTool";
import SubscriptionStatus from "@/components/subscriptions/SubscriptionStatus";
import PricingPlans from "@/components/subscriptions/PricingPlans";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("business");
  const { subscription } = useFeatureAccess();

  const handleSelectPlan = (planId) => {
    // TODO: Redirect to checkout flow
    console.log('Selected plan:', planId);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Settings" 
        description="Business configuration, payment methods, and subscription"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-4">
          <TabsTrigger value="business" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Subscription</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Payments</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <SettingsTool />
        </TabsContent>

        <TabsContent value="subscription" className="mt-6 space-y-8">
          {subscription && <SubscriptionStatus subscription={subscription} />}
          <div className="border-t border-stone-200 pt-8">
            <PricingPlans currentPlan={subscription} onSelectPlan={handleSelectPlan} />
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <PaymentSettingsTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}