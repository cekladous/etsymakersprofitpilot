import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import LineItemDrillDown from "./LineItemDrillDown";

export default function NetProfitStatement({ financialData, dateRange }) {
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState({ title: "", items: [] });

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleDrillDown = (label, categoryName) => {
    let items = [];
    
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
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setDrillDownData({ title: label, items });
    setDrillDownOpen(true);
  };

  const Section = ({ title, tooltip, bgColor = "bg-stone-50" }) => (
    <div className={`${bgColor} py-2 px-4 flex items-center gap-2`}>
      <h3 className="font-semibold text-stone-900">{title}</h3>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-4 h-4 text-stone-400" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  const Row = ({ 
    label, 
    amount, 
    bold = false, 
    categoryName = null, 
    linkTo = null,
    indent = false,
    isNegative = false,
    highlight = ""
  }) => {
    const isClickable = (categoryName && amount !== 0) || linkTo;
    const displayAmount = isNegative ? -Math.abs(amount) : amount;
    
    const content = (
      <div 
        className={`
          flex justify-between items-center py-2 px-4 
          ${highlight}
          ${bold ? "font-semibold border-t border-b border-stone-300 bg-stone-100" : ""} 
          ${isClickable ? "cursor-pointer hover:bg-stone-100 transition-colors" : ""}
          group
        `}
        onClick={() => {
          if (categoryName && !linkTo) {
            handleDrillDown(label, categoryName);
          }
        }}
      >
        <span className={`text-sm ${indent ? "pl-4" : ""} ${bold ? "font-bold" : ""}`}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {isClickable && (
            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
          )}
          <span className={`text-sm ${bold ? "font-bold" : ""} ${displayAmount < 0 ? "text-emerald-600" : ""}`}>
            {formatCurrency(displayAmount)}
          </span>
        </div>
      </div>
    );

    if (linkTo) {
      return <Link to={linkTo}>{content}</Link>;
    }

    return content;
  };

  const buildExpensesLink = (categoryName = null) => {
    if (!dateRange?.start || !dateRange?.end) return createPageUrl("Expenses");
    let url = createPageUrl("Expenses") + 
      `?startDate=${format(dateRange.start, 'yyyy-MM-dd')}&endDate=${format(dateRange.end, 'yyyy-MM-dd')}&range=custom`;
    if (categoryName) {
      url += `&category=${categoryName}`;
    }
    return url;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Net Profit Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          
          {/* REVENUE SECTION */}
          <Section 
            title="Revenue" 
            tooltip="All income from sales, excluding sales tax (which is pass-through to government)"
            bgColor="bg-cyan-50" 
          />
          <Row 
            label="Etsy Sales (item + shipping)" 
            amount={revenue.etsySales || 0}
            linkTo={createPageUrl("Orders")}
          />
          <Row 
            label="Sales Tax Collected" 
            amount={revenue.taxCollectedByEtsy || 0} 
            indent
          />
          <Row 
            label="Total Etsy Sales (incl. tax)" 
            amount={revenue.totalEtsySales || 0} 
            bold 
          />
          <Row 
            label="Etsy Refunds" 
            amount={revenue.etsyRefunds || 0}
            isNegative
            categoryName="etsy_refunds"
          />
          <Row 
            label="Custom Sales A" 
            amount={revenue.customSaleA || 0} 
            highlight="bg-green-50"
          />
          <Row 
            label="Custom Sales B" 
            amount={revenue.customSaleB || 0} 
            highlight="bg-green-50"
          />
          <Row 
            label="Total Revenue (excl. tax)" 
            amount={totalRevenue} 
            bold 
            highlight="bg-blue-50"
          />

          {/* FEES SECTION */}
          <Section 
            title="Fees" 
            tooltip="All Etsy platform fees and payment processing costs from your Payment Account ledger"
            bgColor="bg-orange-50" 
          />
          <Row label="Listing Fees" amount={sellingExpenses.etsyListingFees || 0} categoryName="etsy_listing_fees" />
          <Row label="Transaction Fees" amount={sellingExpenses.etsyTransactionFees || 0} categoryName="etsy_transaction_fees" />
          <Row label="Processing Fees" amount={sellingExpenses.etsyProcessingFees || 0} categoryName="etsy_processing_fees" />
          <Row 
            label="Share & Save Credits" 
            amount={sellingExpenses.shareSaveRefunds || 0} 
            isNegative
            categoryName="share_save_refunds_credits" 
          />
          <Row label="Other Fees" amount={sellingExpenses.otherFees || 0} categoryName="other_fees" />
          <Row label="Etsy Ads" amount={sellingExpenses.etsyAds || 0} categoryName="etsy_ads" />
          <Row label="Offsite Ads" amount={sellingExpenses.etsyOffsiteAds || 0} categoryName="etsy_offsite_ads_fees" />
          <Row label="Total Fees" amount={sellingExpenses.totalEtsyFees || 0} bold />
          
          <Row label="Shipping Labels (Etsy)" amount={sellingExpenses.etsyShipping || 0} categoryName="etsy_shipping" highlight="bg-yellow-50" />
          <Row label="Other Postage" amount={sellingExpenses.otherPostage || 0} categoryName="other_postage_costs" highlight="bg-yellow-50" />

          {/* EXPENSES SECTION */}
          <Section 
            title="Business Expenses" 
            tooltip="Materials, supplies, tools, and operating costs tracked in your Expenses page"
            bgColor="bg-purple-50" 
          />
          <Row 
            label="Materials & Supplies" 
            amount={productExpenses.materialsSupplies || 0} 
            linkTo={buildExpensesLink("materials_supplies")}
          />
          <Row 
            label="Tools & Equipment" 
            amount={productExpenses.toolsEquipment || 0} 
            linkTo={buildExpensesLink("tools_equipment")}
          />
          <Row 
            label="Advertising & Marketing" 
            amount={businessExpenses.advertisingMarketing || 0} 
            linkTo={buildExpensesLink("advertising_marketing")}
          />
          <Row 
            label="Office Expenses" 
            amount={businessExpenses.officeExpenses || 0} 
            linkTo={buildExpensesLink("office_expenses")}
          />
          <Row 
            label="Professional Services" 
            amount={businessExpenses.professionalServices || 0} 
            linkTo={buildExpensesLink("professional_services")}
          />
          <Row 
            label="Other Business Expenses" 
            amount={businessExpenses.other || 0} 
            linkTo={buildExpensesLink("other")}
          />
          <Row 
            label="Miscellaneous" 
            amount={businessExpenses.miscellaneous || 0} 
            linkTo={buildExpensesLink("miscellaneous_expenses")}
          />

          {/* TOTALS */}
          <Row label="Total Expenses" amount={totalExpenses} bold highlight="bg-rose-50" linkTo={buildExpensesLink()} />
          <Row 
            label="Net Profit" 
            amount={netProfit} 
            bold 
            highlight={netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"}
          />

          {/* CASHFLOW (NOT PROFIT) */}
          <div className="mt-4 pt-4 border-t-2 border-stone-300">
            <Section 
              title="Cashflow (not included in profit)" 
              tooltip="Money moved in/out of your business bank account - tracked separately from revenue/expenses"
              bgColor="bg-slate-50" 
            />
            <Row label="Deposits from Etsy" amount={cashflow.etsyDeposits || 0} />
            <Row label="Owner Transfers (Take Home)" amount={cashflow.ownerTransfers || 0} />
          </div>
        </CardContent>
      </Card>

      <LineItemDrillDown
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownData.title}
        items={drillDownData.items}
      />
    </>
  );
}