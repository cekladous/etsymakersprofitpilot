import React from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FeeBreakdownChart({ fees, feeBreakdown, formatCurrency }) {
  // Build chart data from the corrected feeBreakdown object (sourced from OrderFee entity),
  // which matches the category cards below. Falls back to raw fee lines only if no breakdown.
  let feeData;
  if (feeBreakdown) {
    const items = [
      { name: "Listing Fees", value: feeBreakdown.listing },
      { name: "Transaction Fees", value: feeBreakdown.transaction },
      { name: "Processing Fees", value: feeBreakdown.processing },
      { name: "Etsy Ads", value: feeBreakdown.etsy_ads },
      { name: "Offsite Ads", value: feeBreakdown.offsite_ads },
      { name: "Shipping Labels", value: feeBreakdown.shipping },
      { name: "Other Postage", value: feeBreakdown.other_postage },
      { name: "Share & Save Credit", value: feeBreakdown.share_save },
      { name: "Other Fees", value: feeBreakdown.other },
    ];
    feeData = items.filter(item => item.value > 0);
  } else {
    const feeTypeMapping = {
      listing: "Listing Fees",
      transaction: "Transaction Fees",
      processing: "Processing Fees",
      etsy_ads: "Etsy Ads",
      offsite_ads: "Offsite Ads",
      shipping_label: "Shipping Labels",
      other_postage: "Other Postage",
      share_save_credit: "Share & Save Credit",
      other_fee: "Other Fees",
    };
    const aggregatedFees = {};
    (fees || []).forEach(fee => {
      const label = feeTypeMapping[fee.fee_type] || "Other Fees";
      aggregatedFees[label] = (aggregatedFees[label] || 0) + Math.abs(fee.amount || 0);
    });
    feeData = Object.entries(aggregatedFees)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }

  const COLORS = [
    "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"
  ];

  if (feeData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-stone-500">No fee data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fee Distribution (Pie)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={feeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {feeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fee Breakdown (Bar)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={feeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}