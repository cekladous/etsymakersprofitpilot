import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";
import LineItemDrillDown from "./LineItemDrillDown";
import BusinessExpenseDialog from "./BusinessExpenseDialog";
import { groupByPeriod, getPeriodKey } from "@/components/shared/periodHelpers";

export default function MonthlySummaryTable({ filteredData, viewMode = "month" }) {
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

  // Helper to sum ledger entries by matched category
  const sumLedgerByCategory = (category) => {
    return (filteredData.etsyLedgerEntries || [])
      .filter(e => e.matched_category === category)
      .reduce((sum, e) => sum + Math.abs(e.net || 0), 0);
  };

  // Calculate revenue items (include ledger)
  const etsySales = filteredData.etsyOrders.reduce((sum, o) => sum + (o.order_value || 0), 0) +
    (filteredData.etsyLedgerEntries || [])
      .filter(e => e.matched_category === "etsy_sales")
      .reduce((sum, e) => sum + Math.max(e.amount || 0, 0), 0);
  const etsyTax = filteredData.etsyOrders.reduce((sum, o) => sum + (o.sales_tax || 0), 0);
  const totalEtsySales = etsySales + etsyTax;
  const etsyRefunds = 0; // TODO: implement refunds logic
  
  const customSalesA = filteredData.customSales.filter(s => s.sale_type === "A").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  const customSalesB = filteredData.customSales.filter(s => s.sale_type === "B").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  const customSalesC = filteredData.customSales.filter(s => s.sale_type === "C").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  const customSalesD = filteredData.customSales.filter(s => s.sale_type === "D").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
  
  const totalRevenue = totalEtsySales - etsyRefunds + customSalesA + customSalesB + customSalesC + customSalesD;

  // Calculate expense items by category
  const getExpenseByCategory = (categoryName) => {
    return filteredData.businessExpenses
      .filter(e => e.category_name === categoryName)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  // Calculate Etsy fees from BusinessExpense + Ledger
  const etsyListingFees = getExpenseByCategory("etsy_listing_fees") + sumLedgerByCategory("etsy_listing_fees");
  const etsyTransactionFees = getExpenseByCategory("etsy_transaction_fees") + sumLedgerByCategory("etsy_transaction_fees");
  const etsyProcessingFees = getExpenseByCategory("etsy_processing_fees") + sumLedgerByCategory("etsy_processing_fees");
  const shareSaveRefunds = getExpenseByCategory("share_save_refunds_credits") + sumLedgerByCategory("share_save_refunds_credits");
  const otherFees = getExpenseByCategory("other_fees") + sumLedgerByCategory("other_fees");
  const etsyAds = getExpenseByCategory("etsy_ads") + sumLedgerByCategory("etsy_ads");
  const etsyOffsiteAds = getExpenseByCategory("etsy_offsite_ads_fees") + sumLedgerByCategory("etsy_offsite_ads_fees");
  const totalEtsyFees = etsyListingFees + etsyTransactionFees + etsyProcessingFees + shareSaveRefunds + otherFees + etsyAds + etsyOffsiteAds;
  
  const etsyShipping = getExpenseByCategory("etsy_shipping") + sumLedgerByCategory("etsy_shipping");
  const otherPostage = getExpenseByCategory("other_postage_costs") + sumLedgerByCategory("other_postage_costs");
  const customExpenseA = getExpenseByCategory("custom_expense_a");
  const customExpenseB = getExpenseByCategory("custom_expense_b");
  
  // Calculate materials & supplies from both MaterialPurchase and BusinessExpense
  const materialPurchasesTotal = filteredData.materialPurchases?.reduce((sum, p) => sum + (p.total_cost || 0), 0) || 0;
  const materialsSuppliesExpenses = getExpenseByCategory("materials_supplies");
  const materialsSupplies = materialPurchasesTotal + materialsSuppliesExpenses;
  
  const toolsEquipment = getExpenseByCategory("tools_equipment");
  
  const advertisingMarketing = getExpenseByCategory("advertising_marketing");
  const officeExpenses = getExpenseByCategory("office_expenses");
  const professionalServices = getExpenseByCategory("professional_services");
  const other = getExpenseByCategory("other");
  const miscExpenses = getExpenseByCategory("miscellaneous_expenses");
  const customExpenseC = getExpenseByCategory("custom_expense_c");
  
  // Include ledger expenses + material purchases
  const totalExpenses = filteredData.businessExpenses.reduce((sum, e) => sum + (e.amount || 0), 0) +
    materialPurchasesTotal +
    (filteredData.etsyLedgerEntries || [])
      .filter(e => e.status === "Matched" && e.matched_category !== "etsy_sales")
      .reduce((sum, e) => sum + Math.abs(e.net || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const ownerTransfers = filteredData.transfers.filter(t => t.type === "owner_transfer").reduce((sum, t) => sum + (t.amount || 0), 0);
  const etsyDeposits = filteredData.transfers.filter(t => t.type === "etsy_deposit").reduce((sum, t) => sum + (t.amount || 0), 0);

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
    const expenses = filteredData.businessExpenses
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
    <div className={`flex justify-between items-center py-2 px-4 ${highlight} ${bold ? "font-semibold border-t border-b border-stone-300 bg-stone-100" : ""} group hover:bg-stone-50 transition-colors`}>
      <span className={`text-sm ${indent > 0 ? `pl-${indent * 4}` : ""} ${bold ? "font-bold" : ""}`}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        {categoryName && amount > 0 && (
          <button
            onClick={() => handleDrillDown(label, categoryName)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-stone-200 rounded"
          >
            <ChevronRight className="w-4 h-4 text-stone-600" />
          </button>
        )}
        {canAdd && (
          <button
            onClick={() => handleAddExpense(categoryName)}
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
        <Row label="Etsy Sales" amount={etsySales} />
        <Row label="<Tax Collected by Etsy>" amount={etsyTax} />
        <Row label="Total Etsy Sales" amount={totalEtsySales} bold />
        <Row label="Etsy Refunds" amount={etsyRefunds} />
        <Row label="Custom Sales A" amount={customSalesA} highlight="bg-green-50" />
        <Row label="Custom Sales B" amount={customSalesB} highlight="bg-green-50" />
        <Row label="Custom Sales C" amount={customSalesC} highlight="bg-green-50" />
        <Row label="Custom Sales D" amount={customSalesD} highlight="bg-green-50" />
        <Row label="Total Revenue" amount={totalRevenue} bold />

        {/* Expenses Section */}
        <div className="bg-stone-100 py-2 px-4 mt-4">
          <h3 className="font-semibold text-stone-900">Expenses</h3>
        </div>
        
        {/* Selling Expenses */}
        <div className="bg-cyan-50 py-1 px-4">
          <p className="text-sm font-medium">Selling Expenses</p>
        </div>
        <Row label="Etsy Listing Fees" amount={etsyListingFees} categoryName="etsy_listing_fees" canAdd />
        <Row label="Etsy Transaction Fees" amount={etsyTransactionFees} categoryName="etsy_transaction_fees" canAdd />
        <Row label="Etsy Processing Fees" amount={etsyProcessingFees} categoryName="etsy_processing_fees" canAdd />
        <Row label="Share & Save Fee Refunds & Misc. Credits" amount={shareSaveRefunds} categoryName="share_save_refunds_credits" canAdd />
        <Row label="Other Fees" amount={otherFees} categoryName="other_fees" canAdd />
        <Row label="Etsy Ads" amount={etsyAds} categoryName="etsy_ads" canAdd />
        <Row label="Etsy Offsite Ads Fees" amount={etsyOffsiteAds} categoryName="etsy_offsite_ads_fees" canAdd />
        <Row label="Total Etsy Fees" amount={totalEtsyFees} bold />
        <Row label="Etsy Shipping" amount={etsyShipping} highlight="bg-yellow-50" categoryName="etsy_shipping" canAdd />
        <Row label="Other Postage Costs" amount={otherPostage} highlight="bg-yellow-50" categoryName="other_postage_costs" canAdd />
        <Row label="Custom Expense A" amount={customExpenseA} highlight="bg-yellow-50" categoryName="custom_expense_a" canAdd />
        <Row label="Custom Expense B" amount={customExpenseB} highlight="bg-yellow-50" categoryName="custom_expense_b" canAdd />

        {/* Product Expenses */}
        <div className="bg-pink-100 py-1 px-4">
          <p className="text-sm font-medium">Product Expenses</p>
        </div>
        <Row label="Materials & Supplies" amount={materialsSupplies} categoryName="materials_supplies" canAdd />
        <Row label="Tools & Equipment" amount={toolsEquipment} categoryName="tools_equipment" canAdd />

        {/* Business Expenses */}
        <div className="bg-purple-100 py-1 px-4">
          <p className="text-sm font-medium">Business Expenses</p>
        </div>
        <Row label="Advertising & Marketing" amount={advertisingMarketing} categoryName="advertising_marketing" canAdd />
        <Row label="Office Expenses" amount={officeExpenses} categoryName="office_expenses" canAdd />
        <Row label="Professional Services" amount={professionalServices} categoryName="professional_services" canAdd />
        <Row label="Other" amount={other} categoryName="other" canAdd />
        <Row label="Miscellaneous Expenses" amount={miscExpenses} categoryName="miscellaneous_expenses" canAdd />
        <Row label="Custom Expense A" amount={customExpenseA} categoryName="custom_expense_c" canAdd />
        <Row label="Custom Expense B" amount={customExpenseB} categoryName="custom_expense_c" canAdd />
        <Row label="Custom Expense C" amount={customExpenseC} categoryName="custom_expense_c" canAdd />

        <Row label="Total Expenses" amount={totalExpenses} bold />
        <Row label="Net Profit" amount={netProfit} bold highlight={netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"} />

        {/* Transfers */}
        <div className="mt-4 border-t border-stone-200 pt-2">
          <Row label="Owner Transfers/Take Home Pay" amount={ownerTransfers} />
          <Row label="Deposits from Etsy" amount={etsyDeposits} />
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