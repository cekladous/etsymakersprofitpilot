import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import UpgradeCTA from "@/components/subscriptions/UpgradeCTA";
import { useFeatureAccess } from "@/components/shared/useFeatureAccess";

export default function MonthCloseWorkflow({
  open,
  onOpenChange,
  periodStart,
  periodEnd,
  hasUnmatchedEntries,
  unmatchedCount,
  cashflowStatus,
}) {
  const [checklist, setChecklist] = useState({
    reconciliation_checked: false,
    unmatched_reviewed: false,
    refunds_verified: false,
    deposits_verified: false,
  });
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("provisional");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showLockUpgrade, setShowLockUpgrade] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canCloseMonth, canLockMonths, planConfig } = useFeatureAccess();

  const closeMonthMutation = useMutation({
    mutationFn: async () => {
      const month = periodStart.toISOString().substring(0, 7);
      return base44.entities.MonthClosed.create({
        owner_user_id: user.id,
        month,
        period_start: periodStart.toISOString().split("T")[0],
        period_end: periodEnd.toISOString().split("T")[0],
        status,
        checklist,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthsClosed"] });
      setChecklist({
        reconciliation_checked: false,
        unmatched_reviewed: false,
        refunds_verified: false,
        deposits_verified: false,
      });
      setNotes("");
      setStatus("provisional");
      onOpenChange(false);
    },
  });

  const allChecked = Object.values(checklist).every((v) => v);
  const canClose = status === "provisional" || allChecked;

  if (!canCloseMonth()) {
    return (
      <UpgradeCTA
        open={open}
        onOpenChange={onOpenChange}
        feature="month_close"
        currentPlan={planConfig?.name || 'Free'}
      />
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-700" />
            Close Month for {periodStart?.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </DialogTitle>
          <DialogDescription>
            Review checklist before finalizing. This locks the period for tax prep.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Unmatched Alert */}
          {hasUnmatchedEntries && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">⚠️ {unmatchedCount} Unmatched Entries</p>
                <p className="text-sm text-amber-800 mt-1">
                  You have unmatched ledger entries that are excluded from profit. Check "Unmatched Reviewed" only if you've intentionally excluded them.
                </p>
              </div>
            </div>
          )}

          {/* Cashflow Alert */}
          {cashflowStatus === "error" && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">⚠️ Significant Cashflow Gap</p>
                <p className="text-sm text-red-800 mt-1">
                  Your expected vs actual deposits have a large discrepancy. Investigate before closing.
                </p>
              </div>
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
            <p className="font-semibold text-slate-900">Pre-Close Checklist</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={checklist.reconciliation_checked}
                onCheckedChange={(v) =>
                  setChecklist((prev) => ({ ...prev, reconciliation_checked: v }))
                }
              />
              <span className="text-sm">
                ✓ I've verified orders match my statement (reconciliation check passed)
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={checklist.unmatched_reviewed}
                onCheckedChange={(v) =>
                  setChecklist((prev) => ({ ...prev, unmatched_reviewed: v }))
                }
              />
              <span className="text-sm">
                ✓ I've reviewed unmatched ledger entries{hasUnmatchedEntries && ` (${unmatchedCount})`}
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={checklist.refunds_verified}
                onCheckedChange={(v) =>
                  setChecklist((prev) => ({ ...prev, refunds_verified: v }))
                }
              />
              <span className="text-sm">✓ I've confirmed refunds are not double-counted</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={checklist.deposits_verified}
                onCheckedChange={(v) =>
                  setChecklist((prev) => ({ ...prev, deposits_verified: v }))
                }
              />
              <span className="text-sm">✓ I've verified deposits match expected payout</span>
            </label>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">Closure Type</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                style={{ borderColor: status === "provisional" ? "#059669" : "#e2e8f0" }}>
                <input
                  type="radio"
                  name="status"
                  value="provisional"
                  checked={status === "provisional"}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-slate-900">Provisional Close</p>
                  <p className="text-xs text-slate-600">Review done, but can still edit this month</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 border rounded-lg ${!canLockMonths() ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
                style={{ borderColor: status === "final" ? "#059669" : "#e2e8f0" }}>
                <input
                  type="radio"
                  name="status"
                  value="final"
                  checked={status === "final"}
                  onChange={(e) => {
                    if (!canLockMonths()) {
                      setShowLockUpgrade(true);
                      return;
                    }
                    setStatus(e.target.value);
                  }}
                  disabled={!canLockMonths()}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-slate-900">Final Close (Tax Ready)</p>
                  <p className="text-xs text-slate-600">Locks month. No edits allowed. {!canLockMonths() && '(Upgrade to unlock)'}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">Notes (Optional)</p>
            <Textarea
              placeholder="Any adjustments or notes for your records..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => closeMonthMutation.mutate()}
              disabled={!canClose || closeMonthMutation.isPending}
              className={canClose ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300"}
            >
              {closeMonthMutation.isPending ? "Closing..." : `Close Month (${status})`}
            </Button>
          </div>
        </div>
        </DialogContent>
        </Dialog>
        <UpgradeCTA
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        feature="month_close"
        currentPlan={planConfig?.name || 'Free'}
        />
        <UpgradeCTA
        open={showLockUpgrade}
        onOpenChange={setShowLockUpgrade}
        feature="locked_months"
        currentPlan={planConfig?.name || 'Free'}
        />
        </>
        );
        }