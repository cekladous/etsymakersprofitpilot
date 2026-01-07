import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MonthlySummaryTable({ filteredData }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Calculate revenue items
  const etsySales = filteredData.etsyOrders.reduce((sum, o) => sum + (o.order_value || 0), 0);
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

  const etsyListingFees = getExpenseByCategory("etsy_listing_fees");
  const etsyTransactionFees = getExpenseByCategory("etsy_transaction_fees");
  const etsyProcessingFees = getExpenseByCategory("etsy_processing_fees");
  const shareSaveRefunds = getExpenseByCategory("share_save_refunds_credits");
  const otherFees = getExpenseByCategory("other_fees");
  const etsyAds = getExpenseByCategory("etsy_ads");
  const etsyOffsiteAds = getExpenseByCategory("etsy_offsite_ads_fees");
  const totalEtsyFees = etsyListingFees + etsyTransactionFees + etsyProcessingFees + shareSaveRefunds + otherFees + etsyAds + etsyOffsiteAds;
  
  const etsyShipping = getExpenseByCategory("etsy_shipping");
  const otherPostage = getExpenseByCategory("other_postage_costs");
  const customExpenseA = getExpenseByCategory("custom_expense_a");
  const customExpenseB = getExpenseByCategory("custom_expense_b");
  
  const materialsSup plies = getExpenseByCategory("materials_supplies");
  const toolsEquipment = getExpenseByCategory("tools_equipment");
  
  const advertisingMarketing = getExpenseByCategory("advertising_marketing");
  const officeExpenses = getExpenseByCategory("office_expenses");
  const professionalServices = getExpenseByCategory("professional_services");
  const other = getExpenseByCategory("other");
  const miscExpenses = getExpenseByCategory("miscellaneous_expenses");
  const customExpenseC = getExpenseByCategory("custom_expense_c");
  
  const totalExpenses = filteredData.businessExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const ownerTransfers = filteredData.transfers.filter(t => t.type === "owner_transfer").reduce((sum, t) => sum + (t.amount || 0), 0);
  const etsyDeposits = filteredData.transfers.filter(t => t.type === "etsy_deposit").reduce((sum, t) => sum + (t.amount || 0), 0);

  const Row = ({ label, amount, bold = false, indent = 0, highlight = "" }) => (
    <div className={`flex justify-between items-center py-2 px-4 ${highlight} ${bold ? "font-semibold border-t border-b border-stone-300 bg-stone-100" : ""}`}>
      <span className={`text-sm ${indent > 0 ? `pl-${indent * 4}` : ""} ${bold ? "font-bold" : ""}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? "font-bold" : ""}`}>
        {formatCurrency(amount)}
      </span>
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
        <Row label="Etsy Listing Fees" amount={etsyListingFees} />
        <Row label="Etsy Transaction Fees" amount={etsyTransactionFees} />
        <Row label="Etsy Processing Fees" amount={etsyProcessingFees} />
        <Row label="Share & Save Fee Refunds & Misc. Credits" amount={shareSaveRefunds} />
        <Row label="Other Fees" amount={otherFees} />
        <Row label="Etsy Ads" amount={etsyAds} />
        <Row label="Etsy Offsite Ads Fees" amount={etsyOffsiteAds} />
        <Row label="Total Etsy Fees" amount={totalEtsyFees} bold />
        <Row label="Etsy Shipping" amount={etsyShipping} highlight="bg-yellow-50" />
        <Row label="Other Postage Costs" amount={otherPostage} highlight="bg-yellow-50" />
        <Row label="Custom Expense A" amount={customExpenseA} highlight="bg-yellow-50" />
        <Row label="Custom Expense B" amount={customExpenseB} highlight="bg-yellow-50" />

        {/* Product Expenses */}
        <div className="bg-pink-100 py-1 px-4">
          <p className="text-sm font-medium">Product Expenses</p>
        </div>
        <Row label="Materials & Supplies" amount={materialsSupplies} />
        <Row label="Tools & Equipment" amount={toolsEquipment} />

        {/* Business Expenses */}
        <div className="bg-purple-100 py-1 px-4">
          <p className="text-sm font-medium">Business Expenses</p>
        </div>
        <Row label="Advertising & Marketing" amount={advertisingMarketing} />
        <Row label="Office Expenses" amount={officeExpenses} />
        <Row label="Professional Services" amount={professionalServices} />
        <Row label="Other" amount={other} />
        <Row label="Miscellaneous Expenses" amount={miscExpenses} />
        <Row label="Custom Expense A" amount={customExpenseA} />
        <Row label="Custom Expense B" amount={customExpenseB} />
        <Row label="Custom Expense C" amount={customExpenseC} />

        <Row label="Total Expenses" amount={totalExpenses} bold />
        <Row label="Net Profit" amount={netProfit} bold highlight={netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"} />

        {/* Transfers */}
        <div className="mt-4 border-t border-stone-200 pt-2">
          <Row label="Owner Transfers/Take Home Pay" amount={ownerTransfers} />
          <Row label="Deposits from Etsy" amount={etsyDeposits} />
        </div>
      </CardContent>
    </Card>
  );
}