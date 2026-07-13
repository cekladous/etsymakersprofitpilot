import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import LineItemDrillDown from "./LineItemDrillDown";
import { collectDrillDownItems } from "./collectDrillDownItems";

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

  const handleDrillDown = (label, categoryName, expectedTotal) => {
    const items = collectDrillDownItems(categoryName, filteredData);
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    setDrillDownData({ title: label, items, expectedTotal });
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
    isCredit = false,
    highlight = "",
    showPercentage = true,
    isProfitMargin = false
  }) => {
    const hasQuickView = categoryName && amount !== 0;
    const hasLinkTo = linkTo && amount !== 0;
    const displayAmount = isNegative ? -Math.abs(amount) : isCredit ? Math.abs(amount) : amount;
    const percentage = totalRevenue > 0 
      ? (isProfitMargin ? (displayAmount / totalRevenue) * 100 : (Math.abs(displayAmount) / totalRevenue) * 100)
      : 0;
    
    return (
      <div 
        className={`
          flex justify-between items-center py-2 px-4 
          ${highlight}
          ${bold ? "font-semibold border-t border-b border-stone-300 bg-stone-100" : ""} 
          group
        `}
      >
        <span 
          className={`
            text-sm ${indent ? "pl-4" : ""} ${bold ? "font-bold" : ""}
            ${hasQuickView ? "cursor-pointer hover:underline" : ""}
          `}
          onClick={() => {
            if (hasQuickView) {
              handleDrillDown(label, categoryName, displayAmount);
            }
          }}
        >
          {label}
        </span>
        <div className="flex items-center gap-4">
          {hasLinkTo && (
            <Link to={linkTo}>
              <ChevronRight className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer" />
            </Link>
          )}
          {hasQuickView && !hasLinkTo && (
            <div 
              className="cursor-pointer"
              onClick={() => handleDrillDown(label, categoryName, displayAmount)}
            >
              <ChevronRight className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors" />
            </div>
          )}
          <span className={`text-sm ${bold ? "font-bold" : ""} ${isCredit ? "text-emerald-600" : displayAmount < 0 ? "text-rose-600" : ""} min-w-[100px] text-right`}>
            {isCredit ? "+" : ""}{formatCurrency(displayAmount)}
          </span>
          {showPercentage && (
            <span className={`text-xs ${percentage < 0 ? 'text-rose-600' : 'text-stone-500'} min-w-[50px] text-right ${bold ? "font-semibold" : ""}`}>
              {isProfitMargin && totalRevenue === 0 ? 'N/A' : percentage !== 0 ? `${percentage.toFixed(1)}%` : ''}
            </span>
          )}
        </div>
      </div>
    );
  };

  const buildExpensesLink = (categoryName = null) => {
    if (!dateRange?.start || !dateRange?.end) return createPageUrl("Expenses");
    let url = createPageUrl("Expenses") + 
      `?startDate=${format(dateRange.start, 'yyyy-MM-dd')}&endDate=${format(dateRange.end, 'yyyy-MM-dd')}&range=custom&source=netprofit`;
    if (categoryName) {
      url += `&category=${categoryName}`;
    }
    return url;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Total Business Net Profit</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-stone-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-xs font-semibold mb-2">Total Business Net Profit</p>
                  <p className="text-xs mb-2">Includes ALL revenue (Etsy + custom sales) minus ALL expenses (Etsy fees, materials, business expenses). This is your whole-business profit, not just Etsy.</p>
                  <p className="text-xs mb-1">• Revenue excludes sales tax (pass-through)</p>
                  <p className="text-xs mb-1">• Etsy fees + marketing reduce revenue first</p>
                  <p className="text-xs mb-1">• Materials + business expenses reduce profit</p>
                  <p className="text-xs text-stone-500 mt-2">For Etsy-only profit, see Etsy Net Earnings on the Etsy Sales tab. All totals reconcile 1:1 with Expenses page and Orders for the same period.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          
          {/* REVENUE SECTION */}
          <Section 
            title="Revenue" 
            tooltip="All income from sales, excluding sales tax (which is pass-through to government)"
            bgColor="bg-cyan-50" 
          />
          <Row 
            label="Etsy Sales (net)" 
            amount={revenue.etsySales || 0}
            categoryName="etsy_sales"
            linkTo={createPageUrl("Orders")}
          />
          <div className="flex items-center gap-2 py-2 px-4 pl-8">
            <span className="text-sm">Sales Tax Collected</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-3 h-3 text-stone-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Sales tax is excluded from revenue because it's a pass-through to the government. You never receive this money, and it's not included in your 1099-K.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex-1"></div>
            <span className="text-sm min-w-[100px] text-right">{formatCurrency(revenue.taxCollectedByEtsy || 0)}</span>
            <span className="text-xs text-stone-500 min-w-[50px] text-right"></span>
          </div>
          {(revenue.coRetailDeliveryFee || 0) > 0 && (
            <div className="flex items-center justify-between py-2 px-4 pl-8">
              <span className="text-sm">CO Retail Delivery Fee</span>
              <span className="text-sm min-w-[100px] text-right">{formatCurrency(revenue.coRetailDeliveryFee || 0)}</span>
              <span className="text-xs text-stone-500 min-w-[50px] text-right"></span>
            </div>
          )}
          <Row 
            label="Total Etsy Sales (gross)" 
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
            label="Custom Sales / Direct Revenue" 
            amount={revenue.customSales || 0} 
            categoryName="custom_sales"
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
            title="Fees (Platform-Controlled)" 
            tooltip="All Etsy platform fees and payment processing costs. These are deducted from revenue to calculate profit. Fees are different from business expenses."
            bgColor="bg-orange-50" 
          />
          <Row label="Listing Fees" amount={sellingExpenses.etsyListingFees || 0} categoryName="etsy_listing_fees" linkTo={buildExpensesLink("etsy_listing_fees")} />
          <Row label="Transaction Fees" amount={sellingExpenses.etsyTransactionFees || 0} categoryName="etsy_transaction_fees" linkTo={buildExpensesLink("etsy_transaction_fees")} />
          <Row label="Processing Fees" amount={sellingExpenses.etsyProcessingFees || 0} categoryName="etsy_processing_fees" linkTo={buildExpensesLink("etsy_processing_fees")} />
          <Row label="Credits" amount={sellingExpenses.feeCredits || 0} isNegative categoryName="fee_credits" />
          <Row label="Share & Save Refund" amount={sellingExpenses.shareSaveRefunds || 0} isCredit categoryName="share_save_refunds_credits" linkTo={buildExpensesLink("share_save_refunds_credits")} />
          <Row label="Other Fees" amount={sellingExpenses.otherFees || 0} categoryName="other_fees" linkTo={buildExpensesLink("other_fees")} />
          <Row label="Total Fees" amount={sellingExpenses.totalEtsyFees || 0} bold />
          
          {/* MARKETING SECTION */}
          <Section 
            title="Marketing" 
            tooltip="Etsy Ads charges and Etsy Plus subscription fees. These are separate from platform fees."
            bgColor="bg-orange-50" 
          />
          <Row label="Etsy Ads" amount={sellingExpenses.etsyAds || 0} categoryName="etsy_ads" linkTo={buildExpensesLink("etsy_ads")} />
          <Row label="Offsite Ads" amount={sellingExpenses.etsyOffsiteAds || 0} categoryName="etsy_offsite_ads_fees" linkTo={buildExpensesLink("etsy_offsite_ads_fees")} />
          <Row label="Etsy Plus Subscription" amount={sellingExpenses.etsyPlusSubscription || 0} categoryName="etsy_plus_subscription" />
          <Row label="Total Marketing" amount={sellingExpenses.totalMarketing || 0} bold />
          
          <Row label="Shipping Labels (Etsy)" amount={sellingExpenses.etsyShipping || 0} categoryName="etsy_shipping" linkTo={buildExpensesLink("etsy_shipping")} highlight="bg-yellow-50" />
          <Row label="Other Postage" amount={sellingExpenses.otherPostage || 0} categoryName="other_postage_costs" linkTo={buildExpensesLink("other_postage_costs")} highlight="bg-yellow-50" />

          {/* EXPENSES SECTION */}
          <Section 
            title="Business Expenses (Cost of Goods + Operating)" 
            tooltip="All categorized expenses from Materials & Supplies, Tools, Office, Professional Services, and other operating costs. These reduce profit after fees are deducted."
            bgColor="bg-purple-50" 
          />
          <Row 
            label="Materials & Supplies" 
            amount={productExpenses.materialsSupplies || 0} 
            categoryName="materials_supplies"
            linkTo={buildExpensesLink("materials_supplies")}
          />
          <Row 
            label="Tools & Equipment" 
            amount={productExpenses.toolsEquipment || 0} 
            categoryName="tools_equipment"
            linkTo={buildExpensesLink("tools_equipment")}
          />
          <Row 
            label="Advertising & Marketing" 
            amount={businessExpenses.advertisingMarketing || 0} 
            categoryName="advertising_marketing"
            linkTo={buildExpensesLink("advertising_marketing")}
          />
          <Row 
            label="Office Expenses" 
            amount={businessExpenses.officeExpenses || 0} 
            categoryName="office_expenses"
            linkTo={buildExpensesLink("office_expenses")}
          />
          <Row 
            label="Gas & Mileage" 
            amount={businessExpenses.gasMileage || 0} 
            categoryName="gas_mileage"
            linkTo={buildExpensesLink("gas_mileage")}
          />
          <Row 
            label="Utilities & Cell Phone" 
            amount={businessExpenses.utilitiesCellPhone || 0} 
            categoryName="utilities_cell_phone"
            linkTo={buildExpensesLink("utilities_cell_phone")}
          />
          <Row 
            label="Professional Services" 
            amount={businessExpenses.professionalServices || 0} 
            categoryName="professional_services"
            linkTo={buildExpensesLink("professional_services")}
          />
          <Row
            label="Shipping & Postage"
            amount={businessExpenses.shippingPostage || 0}
            categoryName="shipping_postage"
            linkTo={buildExpensesLink("shipping_postage")}
          />
          <Row
            label="Software & Subscriptions"
            amount={businessExpenses.softwareSubscriptions || 0}
            categoryName="software_subscriptions"
            linkTo={buildExpensesLink("software_subscriptions")}
          />
          <Row
            label="Other Business Expenses"
            amount={businessExpenses.other || 0}
            categoryName="other"
            linkTo={buildExpensesLink("other")}
          />
          <Row
            label="Miscellaneous"
            amount={businessExpenses.miscellaneous || 0}
            categoryName="miscellaneous_expenses"
            linkTo={buildExpensesLink("miscellaneous_expenses")}
          />

          {/* TOTALS */}
          <div className="mt-2 pt-2 border-t-2 border-stone-300">
            <Row 
              label="Total Expenses (Fees + Business)" 
              amount={totalExpenses} 
              bold 
              highlight="bg-rose-50" 
              linkTo={buildExpensesLink()}
            />
            <Row 
              label="Total Business Net Profit (Revenue - All Expenses)"
              amount={netProfit} 
              bold 
              highlight={netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"}
              isProfitMargin={true}
            />
          </div>

          {/* CASHFLOW (NOT PROFIT) */}
          <div className="mt-4 pt-4 border-t-2 border-stone-300">
            <Section 
              title="Cashflow (not included in profit)" 
              tooltip="Money moved in/out of your business bank account - tracked separately from revenue/expenses"
              bgColor="bg-slate-50" 
            />
            <Row label="Deposits from Etsy" amount={cashflow.etsyDeposits || 0} categoryName="etsy_deposits" showPercentage={false} />
            <div className="flex items-center gap-2 py-2 px-4">
              <span className="text-sm cursor-pointer hover:underline" onClick={() => handleDrillDown("Owner Transfers (Take Home)", "owner_transfers", cashflow.ownerTransfers || 0)}>
                Owner Transfers (Take Home)
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3 h-3 text-stone-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">Money you've transferred out of your business account as personal income. Manually logged via the "Add Transfer" button above. Defaults to $0 until you enter transfers.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="flex-1"></div>
              <span className="text-sm min-w-[100px] text-right">{formatCurrency(cashflow.ownerTransfers || 0)}</span>
              <span className="text-xs text-stone-500 min-w-[50px] text-right"></span>
            </div>
          </div>
        </CardContent>
      </Card>

      <LineItemDrillDown
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownData.title}
        items={drillDownData.items}
        expectedTotal={drillDownData.expectedTotal}
      />
    </>
  );
}