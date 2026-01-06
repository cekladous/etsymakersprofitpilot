import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusColumns = [
  { status: "pending", label: "Pending", color: "bg-amber-50 border-amber-200" },
  { status: "in_progress", label: "In Progress", color: "bg-blue-50 border-blue-200" },
  { status: "completed", label: "Completed", color: "bg-emerald-50 border-emerald-200" },
];

export default function JobKanbanView({ 
  jobs, 
  products, 
  orders, 
  onEditJob, 
  onViewDetails, 
  onMarkComplete 
}) {
  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || "-";
  };

  const getOrdersForJob = (job) => {
    return orders.filter(o => job.order_ids?.includes(o.id));
  };

  const getJobsByStatus = (status) => {
    return jobs.filter(job => job.status === status);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {statusColumns.map(column => {
        const columnJobs = getJobsByStatus(column.status);
        
        return (
          <div key={column.status} className="space-y-4">
            {/* Column Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-stone-900">{column.label}</h3>
                <Badge variant="outline" className="text-xs">
                  {columnJobs.length}
                </Badge>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3 min-h-[200px]">
              {columnJobs.map(job => {
                const jobOrders = getOrdersForJob(job);
                
                return (
                  <Card 
                    key={job.id} 
                    className={`${column.color} border-2 cursor-pointer hover:shadow-md transition-shadow`}
                    onClick={() => onViewDetails(job)}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-mono font-semibold text-sm text-stone-900">
                            {job.job_number}
                          </p>
                          <p className="text-sm text-stone-600 mt-1">
                            {getProductName(job.product_id)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onViewDetails(job);
                            }}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onEditJob(job);
                            }}>
                              Edit Job
                            </DropdownMenuItem>
                            {job.status !== "completed" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onMarkComplete(job);
                              }}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Quantity</span>
                          <span className="font-medium text-stone-700">{job.quantity || 1}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Cost</span>
                          <span className="font-medium text-stone-900">${(job.total_cost || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Orders</span>
                          <span className="font-medium text-stone-700">{jobOrders.length} linked</span>
                        </div>
                        {job.created_date && (
                          <div className="flex justify-between text-stone-400 pt-1 border-t">
                            <span>Created</span>
                            <span>{format(new Date(job.created_date), "MMM d")}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {columnJobs.length === 0 && (
                <div className="text-center py-8 text-stone-400 text-sm">
                  No {column.label.toLowerCase()} jobs
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}