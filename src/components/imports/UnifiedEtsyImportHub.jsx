import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UnifiedEtsyStatementImport from "./UnifiedEtsyStatementImport";
import EtsySoldOrdersImport from "./EtsySoldOrdersImport";
import EtsyPaymentDepositsImport from "./EtsyPaymentDepositsImport";
import EtsyPaymentAccountImport from "./EtsyPaymentAccountImport";
import UpgradeCTA from "@/components/subscriptions/UpgradeCTA";
import { useFeatureAccess } from "@/components/shared/useFeatureAccess";

export default function UnifiedEtsyImportHub({ open, onOpenChange }) {
  const [activeTab, setActiveTab] = useState("statement");
  const { canImportEtsy, planConfig } = useFeatureAccess();

  if (!canImportEtsy()) {
    return (
      <>
        <UpgradeCTA
          open={open}
          onOpenChange={onOpenChange}
          feature="etsy_import"
          currentPlan={planConfig?.name || 'Free'}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Etsy Data</DialogTitle>
            <DialogDescription>
              Start with your Monthly Statement — it includes all orders, fees, and deposits. The other reports are optional and supplement your data.
            </DialogDescription>
          <p className="text-xs text-muted-foreground mt-2">
            <span className="font-medium">Note for Square users:</span> If you process payments through Square on Etsy, your Etsy statement already includes those sales. Don't also import a Square CSV for the same orders — it will cause duplicates.
          </p>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="statement">Monthly Statement</TabsTrigger>
              <TabsTrigger value="orders">Sold Orders Report</TabsTrigger>
              <TabsTrigger value="deposits">Payment Deposits</TabsTrigger>
              <TabsTrigger value="payment_account">Payment Account</TabsTrigger>
            </TabsList>

            <TabsContent value="statement" className="mt-4">
              <UnifiedEtsyStatementImport
                open={true}
                onOpenChange={() => {}}
                embedded={true}
              />
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <EtsySoldOrdersImport
                open={true}
                onOpenChange={() => {}}
                embedded={true}
              />
            </TabsContent>

            <TabsContent value="deposits" className="mt-4">
              <EtsyPaymentDepositsImport
                open={true}
                onOpenChange={() => {}}
                embedded={true}
              />
            </TabsContent>

            <TabsContent value="payment_account" className="mt-4">
              <EtsyPaymentAccountImport
                open={true}
                onOpenChange={() => {}}
                embedded={true}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}