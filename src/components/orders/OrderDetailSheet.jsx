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

export default function OrderDetailSheet({ order, orderFees, open, onOpenChange }) {
  if (!order) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>Order #{order.order_id}</span>
            <Badge variant="outline">{order.status || "completed"}</Badge>
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

          {/* Financial Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-stone-50 rounded">
                  <span className="text-stone-600 font-medium">Order Value</span>
                  <span className="font-bold text-stone-900 text-lg">
                    {formatCurrency(order.order_value || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded">
                  <span className="text-emerald-700 font-medium">Shipping Charged</span>
                  <span className="font-bold text-emerald-700 text-lg">
                    {formatCurrency(order.shipping_charged || 0)}
                  </span>
                </div>
                {(order.discount_amount || 0) > 0 && (
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                    <span className="text-red-700 font-medium">Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                    <span className="font-bold text-red-700 text-lg">
                      -{formatCurrency(order.discount_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded">
                  <span className="text-amber-700 font-medium">Sales Tax</span>
                  <span className="font-bold text-amber-700 text-lg">
                    {formatCurrency(order.sales_tax || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded border-2 border-blue-200">
                  <span className="text-blue-900 font-bold">Order Total</span>
                  <span className="font-bold text-blue-900 text-xl">
                    {formatCurrency(order.order_total || 0)}
                  </span>
                </div>
                {order.card_processing_fees > 0 && (
                  <div className="flex justify-between items-center p-3 bg-rose-50 rounded">
                    <span className="text-rose-700 font-medium">Card Processing Fees</span>
                    <span className="font-bold text-rose-700">
                      {formatCurrency(order.card_processing_fees)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fees & Charges */}
          {orderFees && orderFees.total_fees > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fees & Charges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {orderFees.listing_fees > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Listing Fees</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.listing_fees)}</span>
                  </div>
                )}
                {orderFees.transaction_fees > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Transaction Fees</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.transaction_fees)}</span>
                  </div>
                )}
                {orderFees.processing_fees > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Processing Fees</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.processing_fees)}</span>
                  </div>
                )}
                {orderFees.etsy_ads > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Etsy Ads</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.etsy_ads)}</span>
                  </div>
                )}
                {orderFees.offsite_ads_fees > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Offsite Ads</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.offsite_ads_fees)}</span>
                  </div>
                )}
                {orderFees.etsy_shipping > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Shipping Label</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.etsy_shipping)}</span>
                  </div>
                )}
                {orderFees.other_postage_costs > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Other Postage</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.other_postage_costs)}</span>
                  </div>
                )}
                {orderFees.share_save_credit > 0 && (
                   <div className="flex justify-between items-center p-2 bg-emerald-100 rounded text-sm border border-emerald-300">
                     <span className="text-emerald-700 font-semibold">✓ Share & Save Credit</span>
                     <span className="text-emerald-700 font-bold">
                       −{formatCurrency(orderFees.share_save_credit)}
                     </span>
                   </div>
                 )}
                {orderFees.other_fees > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-600">Other Fees</span>
                    <span className="text-rose-600">{formatCurrency(orderFees.other_fees)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="font-semibold text-stone-900">Total Fees</span>
                  <span className="font-semibold text-rose-600">
                    {formatCurrency(orderFees.total_fees)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Net Payout Calculation */}
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-emerald-700 font-semibold">Order Earnings Calculation</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center text-stone-600">
                  <span>Item(s) Price</span>
                  <span>{formatCurrency(order.order_value || 0)}</span>
                </div>
                {(order.shipping_charged || 0) > 0 && (
                  <div className="flex justify-between items-center text-emerald-700">
                    <span>+ Shipping Charged (kept by seller)</span>
                    <span>{formatCurrency(order.shipping_charged)}</span>
                  </div>
                )}
                {(order.discount_amount || 0) > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span>- Discount</span>
                    <span>-{formatCurrency(order.discount_amount)}</span>
                  </div>
                )}
                <div className="border-t-2 pt-2 flex justify-between items-center font-medium text-stone-900">
                  <span>Subtotal (before fees)</span>
                  <span>{formatCurrency((order.order_value || 0) + (order.shipping_charged || 0) - (order.discount_amount || 0))}</span>
                </div>
                {(orderFees?.total_fees || 0) > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span>- All Fees & Taxes</span>
                    <span>-{formatCurrency(orderFees.total_fees)}</span>
                  </div>
                )}
                <div className="border-t-2 pt-2 flex justify-between items-center font-semibold text-emerald-700">
                  <span>= Net Earnings</span>
                  <span className="text-2xl text-emerald-600">
                    {formatCurrency(order.order_net || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}