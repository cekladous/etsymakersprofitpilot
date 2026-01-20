import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, CreditCard } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

// Import tool components
import SettingsTool from "@/components/tools/SettingsTool";
import PaymentSettingsTool from "@/components/tools/PaymentSettingsTool";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("business");

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Settings" 
        description="Business configuration, payment methods, and fees"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-2">
          <TabsTrigger value="business" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Payments</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <SettingsTool />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <PaymentSettingsTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}