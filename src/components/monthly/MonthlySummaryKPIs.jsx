import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, CreditCard, Target } from "lucide-react";

export default function MonthlySummaryKPIs({ financialData }) {
  // USE SINGLE SOURCE OF TRUTH - Extract from aggregated data
  const {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
    sellingExpenses,
    businessExpenses,
    cashflow,
  } = financialData;

  const totalAds = sellingExpenses.etsyAds + sellingExpenses.etsyOffsiteAds + businessExpenses.advertisingMarketing;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const KPICard = ({ label, value, icon: Icon, color = "text-stone-900", bgColor = "bg-white" }) => (
    <Card className={bgColor}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</p>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      <KPICard
        label="Total Revenue"
        value={formatCurrency(totalRevenue)}
        icon={DollarSign}
        color="text-blue-600"
      />
      <KPICard
        label="Total Expenses"
        value={formatCurrency(totalExpenses)}
        icon={CreditCard}
        color="text-rose-600"
      />
      <KPICard
        label="Net Profit"
        value={formatCurrency(netProfit)}
        icon={TrendingUp}
        color={netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
      />
      <KPICard
        label="Profit Margin"
        value={`${profitMargin.toFixed(1)}%`}
        icon={Target}
        color={profitMargin >= 0 ? "text-emerald-600" : "text-rose-600"}
      />
      <KPICard
        label="Etsy Fees"
        value={formatCurrency(sellingExpenses.total)}
        icon={CreditCard}
        color="text-orange-600"
      />
      <KPICard
        label="Total Ads"
        value={formatCurrency(totalAds)}
        icon={Target}
        color="text-purple-600"
      />
      <KPICard
        label="Etsy Deposits"
        value={formatCurrency(cashflow.etsyDeposits)}
        icon={DollarSign}
        color="text-teal-600"
      />
      <KPICard
        label="Owner Transfers"
        value={formatCurrency(cashflow.ownerTransfers)}
        icon={DollarSign}
        color="text-indigo-600"
      />
    </div>
  );
}