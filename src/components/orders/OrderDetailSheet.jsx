import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { calculateNetEarnings, perOrderFees } from "@/components/shared/netEarnings";
import ChannelBadge from "@/components/orders/ChannelBadge";
import { isSquareInPersonOrder, SQUARE_FEE_PERCENT, SQUARE_FEE_FIXED } from "@/components/shared/channelUtils";

export default function OrderDetailSheet({ order, orderFees, open, onOpenChange }) {
  if (!order) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Net Earnings = (order_value + shipping_charged - discount_amount) - per_order_fees
  // Per-order fees = transaction + processing - share_save_credit (matches Etsy's "You earned")
  // Shop-level costs (listing, ads, shipping labels) are NOT shown per-order.
  // Sales tax is NOT part of net earnings (collected for buyer, remitted by Etsy)
  const revenueExclTax =
    (order.order_value || 0) +
    (order.shipping_charged || 0) -
    (order.discount_amount || 0);

  const totalBuyerPaid = revenueExclTax + (order.sales_tax || 0);

  const shareSaveCredit = orderFees?.share_save_credit || 0;

  // Etsy's standard transaction fee rate (6.5% as of 2023-present)
  const ETSY_TRANSACTION_RATE = 0.065;
  const isSquare = isSquareInPersonOrder(order);
  const estimatedTransactionFee = Math.round(revenueExclTax * ETSY_TRANSACTION_RATE * 100) / 100;
  const estimatedSquareFee = Math.round((revenueExclTax * SQUARE_FEE_PERCENT + SQUARE_FEE_FIXED) * 100) / 100;

  // Fees & credits total = -(per-order fees + tax)
  // Only transaction + processing - share_save + tax remitted by Etsy
  // Square in-person orders use Square's processing fee instead of Etsy's fees
  const totalFeesPaid = orderFees
    ? -(perOrderFees(orderFees) + (order.sales_tax || 0))
    : isSquare
      ? -(estimatedSquareFee)
      : -(estimatedTransactionFee + (order.card_processing_fees || 0));

  // true only when an Etsy statement import has been done for this order
  const hasStatementData = !!orderFees || order.source === 'etsy_statement';

  const calculatedNetEarnings = calculateNetEarnings(order, orderFees || null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3 flex-wrap">
            <span>Order #{order.order_id}</span>
            <Badge variant="outline">{order.status || "completed"}</Badge>
            <ChannelBadge order={order} />
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Order Date */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Order Date</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-stone-900">
                {order.sale_date ? format(new Date(order.sale_date), "MMM d, yyyy") : "—"}
              </p>
            </CardContent>
          </Card>

          {/* Buyer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Buyer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-stone-500 mb-1">Username</p>
                <p className="font-medium text-stone-900">{order.buyer_username || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1">Full Name</p>
                <p className="font-medium text-stone-900">{order.buyer_full_name || "—"}</p>
              </div>
              {order.payment_method && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">Payment Method</p>
                  <p className="font-medium text-stone-900">{order.payment_method}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-stone-500 mb-1">Quantity</p>
                <p className="font-medium text-stone-900">{order.number_of_items} item{order.number_of_items !== 1 ? "s" : ""}</p>
              </div>
              {order.product_name && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">Product</p>
                  <p className="font-medium text-stone-900">{order.product_name}</p>
                </div>
              )}
              {order.sku && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">SKU</p>
                  <p className="font-medium text-stone-900">{order.sku}</p>
                </div>
              )}
              {order.coupon_code && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">Coupon Code</p>
                  <p className="font-medium text-stone-900">{order.coupon_code}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Etsy-style Financial Breakdown — mirrors Etsy's own order breakdown */}
          <Card className="border-stone-200 overflow-hidden">
            <CardContent className="p-0">

              {/* You earned header */}
              <div className="px-6 py-5 text-center border-b border-stone-100">
                <p className="text-sm text-stone-500 mb-1">You earned</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(calculatedNetEarnings)}
                </p>
                <p className="text-sm text-stone-500 mt-1">on this order</p>
                {!hasStatementData && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠ Estimated — import your Etsy statement for exact figures
                  </p>
                )}
              </div>

              {/* Buyer Paid */}
              <div className="px-6 py-5 border-b border-stone-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-stone-900">Buyer paid</span>
                  <span className="font-semibold text-stone-900">
                    {formatCurrency(
                      (order.order_value || 0) +
                      (order.shipping_charged || 0) -
                      (order.discount_amount || 0) +
                      (order.sales_tax || 0)
                    )}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>Item(s) price</span>
                    <span>{formatCurrency(order.order_value || 0)}</span>
                  </div>
                  {(order.shipping_charged || 0) > 0 && (
                    <div className="flex justify-between text-stone-600">
                      <span>Shipping price</span>
                      <span>{formatCurrency(order.shipping_charged)}</span>
                    </div>
                  )}
                  {(order.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-stone-600">
                      <span>Shop discounts{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                      <span>-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-100">
                    <span>Subtotal</span>
                    <span>{formatCurrency((order.order_value || 0) + (order.shipping_charged || 0) - (order.discount_amount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Total before tax</span>
                    <span>{formatCurrency((order.order_value || 0) + (order.shipping_charged || 0) - (order.discount_amount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Tax paid by buyer</span>
                    <span>{formatCurrency(order.sales_tax || 0)}</span>
                  </div>
                  <p className="text-xs text-stone-400 pl-1">
                    Collected from buyer and remitted by Etsy — not seller income
                  </p>
                </div>
              </div>

              {/* Fees & Credits */}
              <div className="px-6 py-5 border-b border-stone-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-stone-900">Fees &amp; credits</span>
                  <span className="font-semibold text-rose-600">
                    {formatCurrency(totalFeesPaid)}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {orderFees ? (
                    <>
                      {orderFees.transaction_fees > 0 && (
                        <div className="flex justify-between text-stone-600">
                          <span>Transaction fee</span>
                          <span>-{formatCurrency(orderFees.transaction_fees)}</span>
                        </div>
                      )}
                      {orderFees.processing_fees > 0 && (
                        <div className="flex justify-between text-stone-600">
                          <span>Payment processing fee</span>
                          <span>-{formatCurrency(orderFees.processing_fees)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-600">
                        <span>Tax remitted by Etsy</span>
                        <span>-{formatCurrency(order.sales_tax || 0)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Share &amp; Save Refund</span>
                        <span>+{formatCurrency(orderFees.share_save_credit || 0)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {isSquare ? (
                        estimatedSquareFee > 0 && (
                          <div className="flex justify-between text-stone-400">
                            <span>Processing fee (Square est.)</span>
                            <span>-{formatCurrency(estimatedSquareFee)}</span>
                          </div>
                        )
                      ) : (
                        <>
                          {estimatedTransactionFee > 0 && (
                            <div className="flex justify-between text-stone-400">
                              <span>Transaction fee</span>
                              <span>-{formatCurrency(estimatedTransactionFee)}</span>
                            </div>
                          )}
                          {(order.card_processing_fees || 0) > 0 && (
                            <div className="flex justify-between text-stone-400">
                              <span>Processing fee</span>
                              <span>-{formatCurrency(order.card_processing_fees)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between text-stone-400">
                        <span>Share &amp; Save Refund</span>
                        <span>+{formatCurrency(0)}</span>
                      </div>
                      <div className="flex justify-between text-stone-400">
                        <span>Tax remitted by Etsy</span>
                        <span>-{formatCurrency(order.sales_tax || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Net Earnings total */}
              <div className="px-6 py-5 bg-emerald-50 flex justify-between items-center">
                <span className="font-bold text-emerald-800 text-base">= Net Earnings</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(calculatedNetEarnings)}
                </span>
              </div>

            </CardContent>
          </Card>

        </div>
      </SheetContent>
    </Sheet>
  );
}