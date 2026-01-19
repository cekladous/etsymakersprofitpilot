import React from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FeeBreakdownChart({ orderFees, formatCurrency }) {
  // Aggregate fees by type
  const feeData = [
    { name: "Listing Fees", value: orderFees.reduce((sum, f) => sum + (f.listing_fees || 0), 0) },
    { name: "Transaction Fees", value: orderFees.reduce((sum, f) => sum + (f.transaction_fees || 0), 0) },
    { name: "Processing Fees", value: orderFees.reduce((sum, f) => sum + (f.processing_fees || 0), 0) },
    { name: "Etsy Ads", value: orderFees.reduce((sum, f) => sum + (f.etsy_ads || 0), 0) },
    { name: "Offsite Ads", value: orderFees.reduce((sum, f) => sum + (f.offsite_ads_fees || 0), 0) },
    { name: "Shipping Labels", value: orderFees.reduce((sum, f) => sum + (f.etsy_shipping || 0), 0) },
    { name: "Other Postage", value: orderFees.reduce((sum, f) => sum + (f.other_postage_costs || 0), 0) },
    { name: "Share & Save Credit", value: Math.abs(orderFees.reduce((sum, f) => sum + (f.share_save_refunds_credits || 0), 0)) },
    { name: "Other Fees", value: orderFees.reduce((sum, f) => sum + (f.other_fees || 0), 0) },
  ].filter(item => item.value > 0);

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