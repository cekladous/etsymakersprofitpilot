import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MaterialUsageDialog({ open, onOpenChange, sheet, onClose }) {
  const [usageType, setUsageType] = useState("dimensions");
  const [formData, setFormData] = useState({
    width_used: "",
    height_used: "",
    percentage_used: "",
    job_id: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list("-created_date"),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        width_used: "",
        height_used: "",
        percentage_used: "",
        job_id: "",
        notes: "",
      });
      setUsageType("dimensions");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!sheet) return;

      let areaUsed = 0;
      let percentageUsed = 0;

      if (usageType === "dimensions") {
        const width = parseFloat(data.width_used) || 0;
        const height = parseFloat(data.height_used) || 0;
        areaUsed = width * height;
        percentageUsed = (areaUsed / (sheet.total_area || 1)) * 100;
      } else {
        percentageUsed = parseFloat(data.percentage_used) || 0;
        areaUsed = (percentageUsed / 100) * (sheet.total_area || 0);
      }

      const newRemainingArea = Math.max(0, (sheet.remaining_area || 0) - areaUsed);
      const newRemainingPct = (newRemainingArea / (sheet.total_area || 1)) * 100;
      const costPerArea = (sheet.cost || 0) / (sheet.total_area || 1);
      const costAllocated = areaUsed * costPerArea;
      const newRemainingValue = Math.max(0, (sheet.remaining_value || 0) - costAllocated);

      // Create usage record
      await base44.entities.MaterialUsage.create({
        sheet_id: sheet.id,
        job_id: data.job_id || null,
        usage_type: usageType,
        width_used: usageType === "dimensions" ? parseFloat(data.width_used) : null,
        height_used: usageType === "dimensions" ? parseFloat(data.height_used) : null,
        area_used: areaUsed,
        percentage_used: percentageUsed,
        cost_allocated: costAllocated,
        usage_date: format(new Date(), "yyyy-MM-dd"),
        notes: data.notes,
      });

      // Update sheet
      const newStatus = newRemainingPct <= 0 ? "depleted" : 
                        newRemainingPct <= 20 ? "in_use" : "available";

      await base44.entities.MaterialSheet.update(sheet.id, {
        remaining_area: newRemainingArea,
        remaining_percentage: newRemainingPct,
        remaining_value: newRemainingValue,
        status: newStatus,
      });

      // If linked to job, update job material cost
      if (data.job_id) {
        const job = jobs.find(j => j.id === data.job_id);
        if (job) {
          await base44.entities.Job.update(data.job_id, {
            material_cost: (job.material_cost || 0) + costAllocated,
            total_cost: (job.total_cost || 0) + costAllocated,
          });
        }
      }

      return { costAllocated };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materialSheets"] });
      queryClient.invalidateQueries({ queryKey: ["materialUsage"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (!sheet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Usage</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sheet Info */}
          <div className="bg-stone-50 rounded-lg p-4">
            <p className="text-sm text-stone-500 mb-1">Current sheet status</p>
            <p className="font-medium">
              {sheet.remaining_percentage?.toFixed(0)}% remaining • 
              ${sheet.remaining_value?.toFixed(2)} value
            </p>
          </div>

          {/* Usage Type */}
          <div className="space-y-2">
            <Label>Log by</Label>
            <Select value={usageType} onValueChange={setUsageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dimensions">Dimensions (inches)</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {usageType === "dimensions" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Width Used (in)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.width_used}
                  onChange={(e) => setFormData({ ...formData, width_used: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Height Used (in)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.height_used}
                  onChange={(e) => setFormData({ ...formData, height_used: e.target.value })}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Percentage Used</Label>
              <Input
                type="number"
                step="1"
                min="1"
                max="100"
                value={formData.percentage_used}
                onChange={(e) => setFormData({ ...formData, percentage_used: e.target.value })}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Link to Job (optional)</Label>
            <Select
              value={formData.job_id}
              onValueChange={(v) => setFormData({ ...formData, job_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.filter(j => j.status !== "completed").map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.job_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Log Usage
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}