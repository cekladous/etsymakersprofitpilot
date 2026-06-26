import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Zap, Plug } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useFeatureAccess } from "@/components/shared/useFeatureAccess";

import SettingsTool from "@/components/tools/SettingsTool";
import IntegrationsTool from "@/components/settings/IntegrationsTool";
import SubscriptionStatus from "@/components/subscriptions/SubscriptionStatus";
import PricingPlans from "@/components/subscriptions/PricingPlans";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("business");
  const { subscription } = useFeatureAccess();

  const handleSelectPlan = (planId) => {
    console.log('Selected plan:', planId);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Business configuration, data integrations, and subscription"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-3">
          <TabsTrigger value="business" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Plug className="w-4 h-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Subscription</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <SettingsTool />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTool />
        </TabsContent>

        <TabsContent value="subscription" className="mt-6 space-y-8">
          {subscription && <SubscriptionStatus subscription={subscription} />}
          <div className="border-t border-stone-200 pt-8">
            <PricingPlans currentPlan={subscription} onSelectPlan={handleSelectPlan} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}