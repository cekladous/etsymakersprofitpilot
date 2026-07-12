import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

const Row = ({ label, value, bold, indent, color }) => (
  <div className={`flex justify-between py-1.5 ${bold ? "font-bold border-t border-stone-200 mt-1 pt-2" : ""} ${indent ? "pl-4" : ""}`}>
    <span className={`${bold ? "text-stone-900" : "text-stone-600"} ${color || ""}`}>{label}</span>
    <span className={`${bold ? "text-stone-900" : "text-stone-700"} tabular-nums ${color || ""}`}>
      {value < 0 ? "-" : ""}{formatCurrency(Math.abs(value))}
    </span>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-3">
    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">{title}</p>
    {children}
  </div>
);

export default function ProfitLossStatement({ data, year }) {
  if (!data) return null;

  const cogs = (data.productExpenses?.materialsSupplies || 0) + (data.productExpenses?.toolsEquipment || 0);
  const grossProfit = (data.totalRevenue || 0) - cogs;
  const operatingExpenses = (data.sellingExpenses?.total || 0) + (data.businessExpenses?.total || 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit &amp; Loss Statement — {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <Section title="Revenue">
          <Row label="Etsy Sales (Net)" value={data.revenue?.netEtsySales} indent />
          <Row label="Square In-Person" value={data.revenue?.squareInPersonRevenue} indent />
          <Row label="Custom Sales" value={data.revenue?.customRevenueTotal} indent />
          <Row label="Total Revenue" value={data.totalRevenue} bold />
        </Section>

        <Section title="Cost of Goods Sold (COGS)">
          <Row label="Materials & Supplies" value={data.productExpenses?.materialsSupplies} indent />
          <Row label="Tools & Equipment" value={data.productExpenses?.toolsEquipment} indent />
          <Row label="Total COGS" value={cogs} bold />
        </Section>

        <div className="flex justify-between py-2.5 bg-emerald-50 rounded-lg px-3 mb-3">
          <span className="font-bold text-emerald-800">Gross Profit</span>
          <span className="font-bold text-emerald-700 tabular-nums">{formatCurrency(grossProfit)}</span>
        </div>

        <Section title="Operating Expenses">
          <Row label="Selling Expenses (Etsy Fees, Marketing, Shipping)" value={data.sellingExpenses?.total} indent />
          <Row label="Business Expenses (Office, Utilities, Software, etc.)" value={data.businessExpenses?.total} indent />
          <Row label="Total Operating Expenses" value={operatingExpenses} bold />
        </Section>

        <div className={`flex justify-between items-center py-3 px-3 rounded-lg mt-2 ${data.netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
          <span className={`text-lg font-bold ${data.netProfit >= 0 ? "text-emerald-800" : "text-rose-800"}`}>Net Profit</span>
          <span className={`text-lg font-bold tabular-nums ${data.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCurrency(data.netProfit)}</span>
        </div>

        <div className="flex justify-between mt-2 text-sm px-1">
          <span className="text-stone-500">Profit Margin</span>
          <span className="font-medium text-stone-700 tabular-nums">{data.profitMargin ? data.profitMargin.toFixed(1) : "0"}%</span>
        </div>
      </CardContent>
    </Card>
  );
}