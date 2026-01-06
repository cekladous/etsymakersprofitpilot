import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function JobSpreadsheetView({ 
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

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
        <p className="text-stone-500">No jobs match your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50 hover:bg-stone-50">
              <TableHead className="font-semibold text-stone-700">Job #</TableHead>
              <TableHead className="font-semibold text-stone-700">Product</TableHead>
              <TableHead className="font-semibold text-stone-700 text-right">Qty</TableHead>
              <TableHead className="font-semibold text-stone-700">Orders</TableHead>
              <TableHead className="font-semibold text-stone-700 text-right">Material</TableHead>
              <TableHead className="font-semibold text-stone-700 text-right">Machine</TableHead>
              <TableHead className="font-semibold text-stone-700 text-right">Electricity</TableHead>
              <TableHead className="font-semibold text-stone-700 text-right">Overhead</TableHead>
              <TableHead className="font-semibold text-stone-700 text-right">Total Cost</TableHead>
              <TableHead className="font-semibold text-stone-700">Status</TableHead>
              <TableHead className="font-semibold text-stone-700">Created</TableHead>
              <TableHead className="font-semibold text-stone-700">Completed</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const jobOrders = getOrdersForJob(job);
              
              return (
                <TableRow 
                  key={job.id}
                  onClick={() => onViewDetails(job)}
                  className="cursor-pointer hover:bg-stone-50"
                >
                  <TableCell className="font-mono font-medium text-stone-900">
                    {job.job_number}
                  </TableCell>
                  <TableCell className="text-stone-700">
                    {getProductName(job.product_id)}
                  </TableCell>
                  <TableCell className="text-right text-stone-600">
                    {job.quantity || 1}
                  </TableCell>
                  <TableCell className="text-stone-600">
                    {jobOrders.length} linked
                  </TableCell>
                  <TableCell className="text-right text-stone-700">
                    ${(job.material_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-stone-700">
                    ${(job.machine_time_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-stone-700">
                    ${(job.electricity_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-stone-700">
                    ${(job.overhead_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-stone-900">
                    ${(job.total_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="text-stone-500 text-sm">
                    {job.created_date ? format(new Date(job.created_date), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-stone-500 text-sm">
                    {job.completed_at ? format(new Date(job.completed_at), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}