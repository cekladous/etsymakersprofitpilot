import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";
import LineItemDrillDown from "./LineItemDrillDown";
import BusinessExpenseDialog from "./BusinessExpenseDialog";
import { groupByPeriod, getPeriodKey } from "@/components/shared/periodHelpers";

export default function MonthlySummaryTable({ financialData, viewMode = "month" }) {
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState({ title: "", items: [] });
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [preselectedCategory, setPreselectedCategory] = useState(null);
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // USE SINGLE SOURCE OF TRUTH - Extract from aggregated data
  const {
    revenue = {},
    sellingExpenses = {},
    productExpenses = {},
    businessExpenses = {},
    totalRevenue = 0,
    totalExpenses = 0,
    netProfit = 0,
    cashflow = {},
    _rawData: filteredData = {},
  } = financialData || {};

  const handleAddExpense = (categoryName) => {
    setPreselectedCategory(categoryName);
    setExpenseDialogOpen(true);
  };

  const handleDrillDown = (label, categoryName) => {
    let items = [];
    
    // For materials_supplies, include MaterialPurchase records
    if (categoryName === "materials_supplies") {
      const purchases = (filteredData.materialPurchases || []).map(p => ({
        date: p.purchase_date,
        description: p.material_name,
        vendor: p.vendor,
        payment_source: p.payment_method,
        amount: p.total_cost,
      }));
      items.push(...purchases);
    }
    
    // Add BusinessExpense records
    const expenses = (filteredData.businessExpenses || [])
      .filter(e => e.category_name === categoryName)
      .map(e => ({
        date: e.date,
        description: e.description,
        vendor: e.vendor,
        payment_source: e.payment_source,
        amount: e.amount,
      }));
    
    items.push(...expenses);
    
    // Add EtsyLedgerEntry records (matched to this category)
    const ledgerEntries = (filteredData.etsyLedgerEntries || [])
      .filter(e => e.matched_category === categoryName)
      .map(e => ({
        date: e.entry_date,
        description: `${e.title} - ${e.info}`,
        vendor: "Etsy",
        payment_source: "Etsy Payment Ledger",
        amount: Math.abs(e.net || 0),
      }));
    
    items.push(...ledgerEntries);
    
    // Sort by date descending
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setDrillDownData({ title: label, items });
    setDrillDownOpen(true);
  };

  const Row = ({ label, amount, bold = false, indent = 0, highlight = "", categoryName = null, canAdd = false }) => (
    <div 
      className={`flex justify-between items-center py-2 px-4 ${highlight} ${bold ? "font-semibold border-t border-b border-stone-300 bg-stone-100" : ""} group hover:bg-stone-50 transition-colors ${categoryName && amount > 0 ? "cursor-pointer" : ""}`}
      onClick={() => {
        if (categoryName && amount > 0) {
          handleDrillDown(label, categoryName);
        }
      }}
    >
      <span className={`text-sm ${indent > 0 ? `pl-${indent * 4}` : ""} ${bold ? "font-bold" : ""}`}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        {categoryName && amount > 0 && (
          <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
        )}
        {canAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddExpense(categoryName);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-emerald-100 rounded"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
          </button>
        )}
        <span className={`text-sm ${bold ? "font-bold" : ""}`}>
          {formatCurrency(amount)}
        </span>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Business Net Profit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Revenue Section */}
        <div className="bg-cyan-50 py-2 px-4">
          <h3 className="font-semibold text-stone-900">Revenue</h3>
        </div>
        <Row label="Etsy Sales" amount={revenue.etsySales || 0} />
        <Row label="<Tax Collected by Etsy>" amount={revenue.taxCollected || 0} />
        <Row label="Total Etsy Sales" amount={(revenue.etsySales || 0) + (revenue.taxCollected || 0)} bold />
        <Row label="Etsy Refunds" amount={revenue.etsyRefunds || 0} />
        <Row label="Custom Sales A" amount={revenue.customSaleA || 0} highlight="bg-green-50" />
        <Row label="Custom Sales B" amount={revenue.customSaleB || 0} highlight="bg-green-50" />
        <Row label="Total Revenue" amount={totalRevenue} bold />

        {/* Expenses Section */}
        <div className="bg-stone-100 py-2 px-4 mt-4">
          <h3 className="font-semibold text-stone-900">Expenses</h3>
        </div>
        
        {/* Selling Expenses */}
        <div className="bg-cyan-50 py-1 px-4">
          <p className="text-sm font-medium">Selling Expenses</p>
        </div>
        <Row label="Etsy Listing Fees" amount={sellingExpenses.etsyListingFees || 0} categoryName="etsy_listing_fees" canAdd />
        <Row label="Etsy Transaction Fees" amount={sellingExpenses.etsyTransactionFees || 0} categoryName="etsy_transaction_fees" canAdd />
        <Row label="Etsy Processing Fees" amount={sellingExpenses.etsyProcessingFees || 0} categoryName="etsy_processing_fees" canAdd />
        <Row label="Share & Save Fee Refunds & Misc. Credits" amount={sellingExpenses.shareSaveRefunds || 0} categoryName="share_save_refunds_credits" canAdd />
        <Row label="Other Fees" amount={sellingExpenses.otherFees || 0} categoryName="other_fees" canAdd />
        <Row label="Etsy Ads" amount={sellingExpenses.etsyAds || 0} categoryName="etsy_ads" canAdd />
        <Row label="Etsy Offsite Ads Fees" amount={sellingExpenses.etsyOffsiteAds || 0} categoryName="etsy_offsite_ads_fees" canAdd />
        <Row label="Total Etsy Fees" amount={sellingExpenses.total || 0} bold />
        <Row label="Etsy Shipping" amount={sellingExpenses.etsyShipping || 0} highlight="bg-yellow-50" categoryName="etsy_shipping" canAdd />
        <Row label="Other Postage Costs" amount={sellingExpenses.otherPostage || 0} highlight="bg-yellow-50" categoryName="other_postage_costs" canAdd />

        {/* Product Expenses */}
        <div className="bg-pink-100 py-1 px-4">
          <p className="text-sm font-medium">Product Expenses</p>
        </div>
        <Row label="Materials & Supplies" amount={productExpenses.materialsSupplies || 0} categoryName="materials_supplies" canAdd />
        <Row label="Tools & Equipment" amount={productExpenses.toolsEquipment || 0} categoryName="tools_equipment" canAdd />

        {/* Business Expenses */}
        <div className="bg-purple-100 py-1 px-4">
          <p className="text-sm font-medium">Business Expenses</p>
        </div>
        <Row label="Advertising & Marketing" amount={businessExpenses.advertisingMarketing || 0} categoryName="advertising_marketing" canAdd />
        <Row label="Office Expenses" amount={businessExpenses.officeExpenses || 0} categoryName="office_expenses" canAdd />
        <Row label="Professional Services" amount={businessExpenses.professionalServices || 0} categoryName="professional_services" canAdd />
        <Row label="Other" amount={businessExpenses.other || 0} categoryName="other" canAdd />
        <Row label="Miscellaneous Expenses" amount={businessExpenses.miscellaneous || 0} categoryName="miscellaneous_expenses" canAdd />

        <Row label="Total Expenses" amount={totalExpenses} bold />
        <Row label="Net Profit" amount={netProfit} bold highlight={netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"} />

        {/* Transfers */}
        <div className="mt-4 border-t border-stone-200 pt-2">
          <Row label="Owner Transfers/Take Home Pay" amount={cashflow.ownerTransfers || 0} />
          <Row label="Deposits from Etsy" amount={cashflow.etsyDeposits || 0} />
        </div>
      </CardContent>

      {/* Drill-down Dialog */}
      <LineItemDrillDown
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownData.title}
        items={drillDownData.items}
      />

      {/* Expense Dialog */}
      <BusinessExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        preselectedCategory={preselectedCategory}
      />
    </Card>
  );
}