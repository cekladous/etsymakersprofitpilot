import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import StatusBadge from "@/components/shared/StatusBadge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function JobDetailSheet({ job, open, onOpenChange }) {
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list(),
    enabled: open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
    enabled: open,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
    enabled: open,
  });

  if (!job) return null;

  const linkedOrders = orders.filter(o => job.order_ids?.includes(o.id));
  const product = products.find(p => p.id === job.product_id);

  const totalRevenue = linkedOrders.reduce((sum, o) => 
    sum + (o.gross_total || 0) - (o.sales_tax || 0) - (o.refunds || 0), 0);
  const totalFees = linkedOrders.reduce((sum, o) => 
    sum + (o.etsy_fees || 0) + (o.processing_fees || 0), 0);
  const profit = totalRevenue - totalFees - (job.total_cost || 0);
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-mono">{job.job_number}</SheetTitle>
            <StatusBadge status={job.status} />
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-stone-500">Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-stone-500">Product</p>
                <p className="font-medium">{product?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Quantity</p>
                <p className="font-medium">{job.quantity || 1}</p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Created</p>
                <p className="font-medium">
                  {job.created_date ? format(new Date(job.created_date), "MMM d, yyyy") : "-"}
                </p>
              </div>
              {job.completed_at && (
                <div>
                  <p className="text-sm text-stone-500">Completed</p>
                  <p className="font-medium">
                    {format(new Date(job.completed_at), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Operations */}
          {job.operations?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-stone-500">Operations</h4>
              <div className="space-y-2">
                {job.operations.map((op, i) => {
                  const machine = machines.find(m => m.id === op.machine_id);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                      <div>
                        <Badge variant="outline" className="capitalize">{op.type}</Badge>
                        <span className="text-sm text-stone-600 ml-2">{machine?.name || "Unknown"}</span>
                      </div>
                      <span className="text-sm font-medium">{op.duration_minutes} min</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Costs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-stone-500">Costs</h4>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Material</span>
                <span className="font-medium">${(job.material_cost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Machine Time</span>
                <span className="font-medium">${(job.machine_time_cost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Electricity</span>
                <span className="font-medium">${(job.electricity_cost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Overhead</span>
                <span className="font-medium">${(job.overhead_cost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Depreciation</span>
                <span className="font-medium">${(job.depreciation_cost || 0).toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-semibold">Total Cost</span>
                <span className="font-bold text-rose-600">${(job.total_cost || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Profit Analysis */}
          {linkedOrders.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-stone-500">Profit Analysis</h4>
              <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Revenue</span>
                  <span className="font-medium">${totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Fees</span>
                  <span className="font-medium text-rose-600">-${totalFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Production Cost</span>
                  <span className="font-medium text-rose-600">-${(job.total_cost || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-emerald-200 pt-2 flex justify-between">
                  <span className="font-semibold">Net Profit</span>
                  <span className={`font-bold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    ${profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Margin</span>
                  <span className={`font-semibold ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Linked Orders */}
          {linkedOrders.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-stone-500">Linked Orders ({linkedOrders.length})</h4>
              <div className="space-y-2">
                {linkedOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={createPageUrl("Orders")}
                    className="block p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{order.order_id}</span>
                        <p className="text-sm text-stone-500">{order.product_name || order.sku}</p>
                      </div>
                      <span className="font-medium text-emerald-600">
                        ${(order.gross_total || 0).toFixed(2)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-stone-500">Notes</h4>
              <p className="text-sm text-stone-700">{job.notes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}