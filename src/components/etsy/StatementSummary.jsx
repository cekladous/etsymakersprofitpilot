import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function StatementSummary({ user }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  const { data: statementLines = [], isLoading } = useQuery({
    queryKey: ["statement-lines-month", user?.id, selectedMonth],
    enabled: !!user && !!selectedMonth,
    queryFn: async () => {
      const all = await base44.entities.EtsyStatementLine.filter({ owner_user_id: user.id }, "-transaction_date", 10000);
      return all.filter(l => l.transaction_date && l.transaction_date.startsWith(selectedMonth));
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-month", user?.id, selectedMonth],
    enabled: !!user && !!selectedMonth,
    queryFn: async () => {
      const all = await base44.entities.EtsyOrder.filter({ owner_user_id: user.id }, "-sale_date", 1000);
      return all.filter(o => o.sale_date && o.sale_date.startsWith(selectedMonth));
    },
  });

  const { data: deposits = [] } = useQuery({
    queryKey: ["deposits-month", user?.id, selectedMonth],
    enabled: !!user && !!selectedMonth,
    queryFn: async () => {
      const all = await base44.entities.Transfer.filter({ owner_user_id: user.id }, "-date", 1000);
      return all.filter(t => t.type === "etsy_deposit" && t.date && t.date.startsWith(selectedMonth));
    },
  });

  const { data: availableMonths = [] } = useQuery({
    queryKey: ["statement-months", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const imports = await base44.entities.EtsyStatementImport.filter({ owner_user_id: user.id }, "-imported_at");
      return [...new Set(imports.filter(i => i.status !== 'replaced').map(i => i.statement_month))].sort().reverse();
    },
  });

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths]);

  const formatCurrency = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);
  const fmt = (v) => `$${(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const summary = useMemo(() => {
    const lines = statementLines;

    // Gross sales from EtsyOrder records (order_total includes item + shipping + tax + fees - discounts - refunds)
    const grossSales = orders.reduce((s, o) => s + (o.order_total || 0) - (o.refund_amount || 0), 0);
    const salesCount = orders.length;

    // Net sales: exclude sales tax and CO retail delivery fee (government-mandated, not seller revenue)
    const salesTax = orders.reduce((s, o) => s + (o.sales_tax || 0), 0);
    // CO retail delivery fee = portion of order_total that is neither item, shipping, tax, nor discount
    const coRetailDeliveryFee = orders.reduce((s, o) => {
      const expected = (o.order_value || 0) + (o.shipping_charged || 0) + (o.sales_tax || 0) - (o.discount_amount || 0);
      return s + Math.max(0, (o.order_total || 0) - expected);
    }, 0);
    const netSales = grossSales - salesTax - coRetailDeliveryFee;

    const feeLines = lines.filter(l => l.section === 'fees');
    const feesTotal = feeLines.reduce((s, l) => s + (l.amount || 0), 0);

    const marketingLines = lines.filter(l => l.section === 'ads');
    const marketingTotal = marketingLines.reduce((s, l) => s + (l.amount || 0), 0);

    const shippingLines = lines.filter(l => l.section === 'shipping');
    const shippingTotal = shippingLines.reduce((s, l) => s + (l.amount || 0), 0);

    const depositsTotal = deposits.reduce((s, d) => s + (d.amount || 0), 0);

    // Etsy Net = Net Sales - Fees - Marketing - Shipping (matches Etsy's official statement)
    const etsyNet = netSales + feesTotal + marketingTotal + shippingTotal;
    const difference = etsyNet - depositsTotal;

    return {
      grossSales,
      netSales,
      salesTax,
      coRetailDeliveryFee,
      feesTotal: Math.abs(feesTotal),
      marketingTotal: Math.abs(marketingTotal),
      shippingTotal: Math.abs(shippingTotal),
      depositsTotal,
      etsyNet,
      difference,
      salesCount,
      feeCount: feeLines.length,
      marketingCount: marketingLines.length,
      shippingCount: shippingLines.length,
    };
  }, [statementLines, deposits, orders]);

  const internalProfit = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + (o.order_value || 0), 0);
    const shipping = orders.reduce((s, o) => s + (o.shipping_charged || 0), 0);
    const discounts = orders.reduce((s, o) => s + (o.discount_amount || 0), 0);
    const refunds = orders.reduce((s, o) => s + (o.refund_amount || 0), 0);
    const salesTax = orders.reduce((s, o) => s + (o.sales_tax || 0), 0);

    const feeLines = statementLines.filter(l => l.section === 'fees');
    const etsyFees = Math.abs(feeLines.reduce((s, l) => s + (l.amount || 0), 0));

    const marketingLines = statementLines.filter(l => l.section === 'ads');
    const marketing = Math.abs(marketingLines.reduce((s, l) => s + (l.amount || 0), 0));

    return {
      revenue,
      shipping,
      discounts,
      refunds,
      salesTax,
      etsyFees,
      marketing,
      net: revenue + shipping - discounts - refunds - etsyFees - marketing,
    };
  }, [orders, statementLines]);

  // Detect missing statement categories that Etsy's monthly statement should contain
  const missingCategories = useMemo(() => {
    const missing = [];
    const hasOffsiteAds = statementLines.some(l => l.fee_type === 'offsite_ads');
    const hasEtsyPlus = statementLines.some(l =>
      l.fee_type === 'etsy_plus_subscription' ||
      (l.description || '').toLowerCase().includes('etsy plus') ||
      (l.description || '').toLowerCase().includes('subscription')
    );
    const hasDeposits = deposits.length > 0;
    const hasShipping = statementLines.some(l => l.section === 'shipping');

    if (!hasOffsiteAds) {
      missing.push({
        name: 'Offsite Ads',
        reason: 'No Offsite Ads rows found. If you run Offsite Ads, this fee may be missing from the uploaded CSV.',
      });
    }
    if (!hasEtsyPlus) {
      missing.push({
        name: 'Etsy Plus Subscription',
        reason: 'Etsy Plus subscription ($10/mo) is billed to your credit card and does not appear in the Payment Account CSV. This is expected.',
      });
    }
    if (!hasDeposits) {
      missing.push({
        name: 'Deposits / Payouts',
        reason: 'No bank deposits found for this month. Import the Etsy Deposits CSV or add deposits manually on the Deposits tab.',
      });
    }
    if (!hasShipping) {
      missing.push({
        name: 'Shipping Labels',
        reason: 'No shipping label or postage rows found. If you purchased labels through Etsy, they may be missing from this file.',
      });
    }
    return missing;
  }, [statementLines, deposits]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><div className="w-8 h-8 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Etsy Statement Summary</CardTitle>
          <CardDescription>
            Reconciliation of imported Etsy statement data. Fees and Marketing are pulled directly from the Etsy Payment Account CSV and match your official statement exactly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-stone-600">Statement Month:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {statementLines.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              <p>No statement data found for {selectedMonth}.</p>
              <p className="text-sm mt-1">Import an Etsy Monthly Statement to see the reconciliation summary.</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-stone-200 overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
                  <p className="text-sm font-semibold text-stone-700">Imported Statement Categories</p>
                </div>
                <div className="divide-y divide-stone-100">
                  <SummaryRow label="Gross Sales" value={summary.grossSales} sublabel={`${summary.salesCount} transactions`} positive />
                  <SummaryRow label="Sales Tax (remitted by Etsy)" value={-summary.salesTax} sublabel="Excluded from net sales" />
                  {summary.coRetailDeliveryFee > 0 && (
                    <SummaryRow label="CO Retail Delivery Fee" value={-summary.coRetailDeliveryFee} sublabel="Excluded from net sales" />
                  )}
                  <SummaryRow label="Net Sales" value={summary.netSales} sublabel="Excludes tax & CO fee" bold positive />
                  <SummaryRow label="Fees" value={-summary.feesTotal} sublabel={`${summary.feeCount} fee lines`} />
                  <SummaryRow label="Marketing" value={-summary.marketingTotal} sublabel={`${summary.marketingCount} marketing lines`} />
                  <SummaryRow label="Shipping" value={-summary.shippingTotal} sublabel={`${summary.shippingCount} shipping lines`} />
                  <SummaryRow label="Imported Statement Net" value={summary.etsyNet} sublabel="Matches Etsy official statement" bold highlight />
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
                  <p className="text-sm font-semibold text-stone-700">Deposits / Payouts</p>
                </div>
                <div className="divide-y divide-stone-100">
                  <SummaryRow label="Total Deposits" value={summary.depositsTotal} sublabel={`${deposits.length} deposits`} positive />
                  <SummaryRow label="Difference (Imported Net - Deposits)" value={summary.difference} sublabel={Math.abs(summary.difference) < 0.01 ? "Reconciled" : Math.abs(summary.difference) < 50 ? "Normal payout timing" : "Needs review"} bold highlight={Math.abs(summary.difference) < 0.01} />
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
                  <p className="text-sm font-semibold text-stone-700">Tax (Remitted by Etsy)</p>
                </div>
                <div className="divide-y divide-stone-100">
                  <SummaryRow label="Sales Tax Collected" value={summary.taxTotal} sublabel="Not seller revenue — remitted by Etsy" />
                </div>
              </div>

              {Math.abs(summary.difference) < 0.01 ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-900">Statement Reconciled</p>
                    <p className="text-sm text-emerald-700">Etsy Net matches total deposits for {selectedMonth}.</p>
                  </div>
                </div>
              ) : Math.abs(summary.difference) < 50 ? (
                <div className="flex items-center gap-3 bg-stone-100 border border-stone-200 rounded-lg p-4">
                  <AlertCircle className="w-5 h-5 text-stone-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-stone-700">
                      {fmt(Math.abs(summary.difference))} {summary.difference > 0 ? 'pending deposit' : 'minor overage'} — normal payout timing
                    </p>
                    <p className="text-sm text-stone-500">
                      Imported Statement Net ({formatCurrency(summary.etsyNet)}) differs from deposits ({formatCurrency(summary.depositsTotal)}) by {formatCurrency(summary.difference)}. This is normal — deposits may arrive a day or two after the statement period closes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">Reconciliation Difference</p>
                    <p className="text-sm text-amber-700">
                      Imported Statement Net ({formatCurrency(summary.etsyNet)}) differs from deposits ({formatCurrency(summary.depositsTotal)}) by {formatCurrency(summary.difference)}.
                      This may indicate a missing deposit entry or a statement line that needs review.
                    </p>
                  </div>
                </div>
              )}

              {missingCategories.length > 0 && (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900">Missing Statement Categories</p>
                      <p className="text-sm text-blue-700 mb-2">
                        The following categories were not found in the uploaded file. This may indicate incomplete source data.
                      </p>
                      <div className="space-y-2">
                        {missingCategories.map((cat, idx) => (
                          <div key={idx} className="text-sm bg-white/50 rounded-md p-2">
                            <span className="font-medium text-blue-900">{cat.name}:</span>{" "}
                            <span className="text-blue-700">{cat.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Internal Profit View removed — see the Etsy Sales > Orders tab for the per-order profit breakdown. */}
    </div>
  );
}

function SummaryRow({ label, value, sublabel, bold, positive, highlight }) {
  const formatCurrency = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${bold ? "bg-stone-50 font-semibold" : ""}`}>
      <div>
        <span className={`text-sm ${bold ? "font-semibold text-stone-900" : "text-stone-700"}`}>{label}</span>
        {sublabel && <span className="text-xs text-stone-400 ml-2">{sublabel}</span>}
      </div>
      <span className={`text-sm font-medium ${highlight ? (value >= 0 ? "text-emerald-600" : "text-rose-600") : (value < 0 ? "text-rose-600" : positive ? "text-emerald-600" : "text-stone-900")}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function MiniStat({ label, value, expense, highlight, muted }) {
  const formatCurrency = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-emerald-200 bg-emerald-50" : muted ? "border-stone-200 bg-stone-50" : "border-stone-200"}`}>
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-lg font-bold ${expense ? "text-rose-600" : highlight ? "text-emerald-600" : muted ? "text-stone-400" : "text-stone-900"}`}>
        {expense ? "-" : ""}{formatCurrency(value)}
      </p>
    </div>
  );
}