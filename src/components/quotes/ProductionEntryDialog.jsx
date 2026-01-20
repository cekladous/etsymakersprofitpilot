import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";

export default function ProductionEntryDialog({ job, open, onOpenChange, onSuccess }) {
  const [materialCost, setMaterialCost] = useState(job?.actual_material_cost || 0);
  const [machineHours, setMachineHours] = useState(job?.actual_machine_hours || 0);
  const [machineHourlyRate, setMachineHourlyRate] = useState(0);
  const [laborHours, setLaborHours] = useState(job?.actual_labor_hours || 0);
  const [laborRate, setLaborRate] = useState(job?.actual_labor_rate || 0);

  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["settings", job?.owner_user_id],
    enabled: !!job?.owner_user_id,
    queryFn: async () => {
      const list = await base44.entities.Settings.filter({ owner_user_id: job.owner_user_id });
      return list.find(s => s.setting_key === "default") || null;
    },
  });

  // Calculate costs
  const machineCost = (machineHours || 0) * (machineHourlyRate || 0);
  const laborCost = (laborHours || 0) * (laborRate || 0);
  const actualTotalCost = (materialCost || 0) + machineCost + laborCost;
  const quotedCost = job?.quoted_total_cost || 0;
  const variance = actualTotalCost - quotedCost;
  const variancePercent = quotedCost > 0 ? ((actualTotalCost / quotedCost) * 100) : 0;
  const isOver = variance > 0;

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(job.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      actual_material_cost: materialCost,
      actual_machine_hours: machineHours,
      actual_labor_hours: laborHours,
      actual_labor_rate: laborRate,
      total_cost: actualTotalCost,
      status: "in_progress",
      started_at: job?.started_at || new Date().toISOString(),
    });
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Production Entry - {job.job_number}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="materials" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="machine">Machine</TabsTrigger>
            <TabsTrigger value="labor">Labor</TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Actual Materials Used Cost</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-600">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={materialCost}
                  onChange={(e) => setMaterialCost(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-stone-500">Enter actual cost of materials consumed</p>
            </div>
          </TabsContent>

          <TabsContent value="machine" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Machine Hours</label>
                <Input
                  type="number"
                  step="0.25"
                  value={machineHours}
                  onChange={(e) => setMachineHours(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hourly Rate ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={machineHourlyRate}
                  onChange={(e) => setMachineHourlyRate(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="bg-stone-50 p-3 rounded-lg">
              <p className="text-sm text-stone-600">
                Machine Cost: <span className="font-semibold">${machineCost.toFixed(2)}</span>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="labor" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Labor Hours (Optional)</label>
                <Input
                  type="number"
                  step="0.25"
                  value={laborHours}
                  onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hourly Rate ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={laborRate}
                  onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="bg-stone-50 p-3 rounded-lg">
              <p className="text-sm text-stone-600">
                Labor Cost: <span className="font-semibold">${laborCost.toFixed(2)}</span>
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary Card */}
        <Card className="bg-stone-50 border-stone-200">
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Quoted Cost:</span>
              <span className="font-semibold">${quotedCost.toFixed(2)}</span>
            </div>
            <div className="border-t border-stone-200"></div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Materials:</span>
                <span>${materialCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Machine:</span>
                <span>${machineCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">Labor:</span>
                <span>${laborCost.toFixed(2)}</span>
              </div>
            </div>
            <div className="border-t border-stone-200"></div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Actual Total Cost:</span>
              <span>${actualTotalCost.toFixed(2)}</span>
            </div>

            {/* Variance Display */}
            <div className={`p-3 rounded-lg flex items-start gap-3 ${
              isOver ? "bg-rose-50 border border-rose-200" : "bg-emerald-50 border border-emerald-200"
            }`}>
              {isOver ? (
                <TrendingUp className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              ) : (
                <TrendingDown className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${isOver ? "text-rose-700" : "text-emerald-700"}`}>
                  {isOver ? "Over Budget" : "Under Budget"}
                </p>
                <p className={`text-sm ${isOver ? "text-rose-600" : "text-emerald-600"}`}>
                  ${Math.abs(variance).toFixed(2)} ({variancePercent.toFixed(0)}%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateMutation.isPending ? "Saving..." : "Save Production Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}