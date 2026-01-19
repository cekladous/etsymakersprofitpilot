import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Building, MapPin, FileText, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import OrderDetailSheet from "@/components/orders/OrderDetailSheet";

export default function CustomerDetailSheet({ customer, open, onOpenChange }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { data: quotes = [] } = useQuery({
    queryKey: ["customer-quotes", customer?.id],
    queryFn: () => base44.entities.Quote.filter({ customer_name: customer?.name }),
    enabled: !!customer,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", customer?.id],
    queryFn: async () => {
      const etsyOrders = await base44.entities.EtsyOrder.filter({ 
        buyer_full_name: customer?.name 
      });
      return etsyOrders || [];
    },
    enabled: !!customer,
  });

  if (!customer) return null;

  const totalQuoteValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
  const totalOrderValue = orders.reduce((sum, o) => sum + (o.order_total || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">{customer.name}</SheetTitle>
          {customer.company && (
            <p className="text-stone-500">{customer.company}</p>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-stone-400" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-stone-400" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.company && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="w-4 h-4 text-stone-400" />
                  <span>{customer.company}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-stone-400" />
                  <span>{customer.address}</span>
                </div>
              )}
              {customer.notes && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-stone-600">{customer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-stone-900">{quotes.length}</div>
                <div className="text-sm text-stone-500">Total Quotes</div>
                <div className="text-lg font-semibold text-emerald-600 mt-1">
                  ${totalQuoteValue.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-stone-900">{orders.length}</div>
                <div className="text-sm text-stone-500">Total Orders</div>
                <div className="text-lg font-semibold text-emerald-600 mt-1">
                  ${totalOrderValue.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quotes History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <CardTitle className="text-base">Quotes</CardTitle>
                </div>
                {quotes.length > 0 && (
                  <Link to={createPageUrl("Quotes")}>
                    <Button size="sm" variant="outline">View All</Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-4">No quotes yet</p>
              ) : (
                <div className="space-y-3">
                  {quotes.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">#{quote.quote_number}</div>
                        <div className="text-xs text-stone-500">{quote.project_name}</div>
                        <div className="text-xs text-stone-400 mt-1">
                          {format(new Date(quote.created_date), "MMM dd, yyyy")}
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={quote.status} />
                        <div className="font-semibold text-sm mt-1">${quote.total?.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  <CardTitle className="text-base">Orders</CardTitle>
                </div>
                {orders.length > 0 && (
                  <Link to={createPageUrl("Orders")}>
                    <Button size="sm" variant="outline">View All</Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-4">No orders yet</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-center justify-between p-3 bg-stone-50 rounded-lg hover:bg-stone-100 cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-medium text-sm">{order.order_id}</div>
                        <div className="text-xs text-stone-500">{order.product_name}</div>
                        <div className="text-xs text-stone-400 mt-1">
                          {format(new Date(order.sale_date), "MMM dd, yyyy")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">${order.order_total?.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>

    <OrderDetailSheet
      order={selectedOrder}
      open={!!selectedOrder}
      onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}
    />
  );
}