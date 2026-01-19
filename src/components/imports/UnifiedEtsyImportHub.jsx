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

export default function UnifiedEtsyImportHub({ open, onOpenChange }) {
  const [activeTab, setActiveTab] = useState("statement");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Etsy Data</DialogTitle>
          <DialogDescription>
            Choose which type of data to import. Both sources will merge together automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="statement">Monthly Statement</TabsTrigger>
            <TabsTrigger value="orders">Sold Orders Report</TabsTrigger>
          </TabsList>

          <TabsContent value="statement" className="mt-6">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-semibold mb-2">📊 Monthly Statement CSV</p>
                <ul className="text-sm text-blue-900 space-y-1 ml-4 list-disc">
                  <li>Go to Etsy → Finances → Payment Account</li>
                  <li>Select a month and download CSV (not PDF)</li>
                  <li>Imports: Orders, Fees, Ads, Shipping Labels, Deposits</li>
                </ul>
              </div>
              <UnifiedEtsyStatementImport 
                open={true} 
                onOpenChange={() => {}} 
                embedded={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-900 font-semibold mb-2">📦 Sold Orders Report CSV</p>
                <ul className="text-sm text-emerald-900 space-y-1 ml-4 list-disc">
                  <li>Go to Etsy → Shop Manager → Orders</li>
                  <li>Click "Download CSV" to export all sold orders</li>
                  <li>Supplements with: Product details, SKUs, buyer info</li>
                </ul>
              </div>
              <EtsySoldOrdersImport 
                open={true} 
                onOpenChange={() => {}} 
                embedded={true}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}