import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";
import DataTable from "@/components/ui/DataTable";

/**
 * @typedef {Object} DuplicateGroup
 * @property {string} key - dedup key
 * @property {Array} records - all records sharing this key (2+ = duplicates)
 * @property {boolean} isRecurring - whether this looks like a recurring expense
 * @property {string} recurringHint - human-readable reason
 */

/**
 * Groups duplicate records and detects potential recurring expenses.
 * A group is considered recurring if the same description+amount appears
 * across multiple distinct months.
 */
export function findDuplicateGroups(allRecords) {
  const groups = {};
  for (const r of allRecords) {
    const key = `${r.date}|${Math.abs(r.amount || 0).toFixed(2)}|${(r.description || "").substring(0, 40).trim().toLowerCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const duplicateGroups = Object.entries(groups)
    .filter(([, records]) => records.length > 1)
    .map(([key, records]) => {
      // Detect recurring: same description+amount across different months
      const descKey = (records[0].description || "").substring(0, 40).trim().toLowerCase();
      const amtKey = Math.abs(records[0].amount || 0).toFixed(2);
      const months = new Set(
        records.map((r) => {
          const d = r.date ? new Date(r.date + "T00:00:00") : null;
          return d ? `${d.getFullYear()}-${d.getMonth()}` : "unknown";
        })
      );
      const recurringByMonth = months.size > 1;

      // Also check if any record already has is_recurring flag
      const hasRecurringFlag = records.some((r) => r.is_recurring);

      const isRecurring = recurringByMonth || hasRecurringFlag;

      let recurringHint = "";
      if (hasRecurringFlag) {
        recurringHint = "Already flagged as recurring";
      } else if (recurringByMonth) {
        recurringHint = `Same description + amount in ${months.size} different months`;
      }

      return { key, records, isRecurring, recurringHint, descKey, amtKey };
    });

  return duplicateGroups;
}

export default function DuplicateReviewDialog({
  open,
  onOpenChange,
  duplicateGroups,
  onDelete,
  onMarkRecurring,
  deleting,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set([0]));

  const toggleGroupExpanded = (idx) => {
    const next = new Set(expandedGroups);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedGroups(next);
  };

  const toggleIdSelected = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllDuplicates = () => {
    const all = new Set();
    duplicateGroups.forEach((g) => {
      // Select all but the first record in each group (keep the original)
      g.records.slice(1).forEach((r) => all.add(r.id));
    });
    setSelectedIds(all);
  };

  const handleDeleteSelected = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleMarkRecurring = (group) => {
    // Mark all records in the group as recurring (keep them all)
    onMarkRecurring(group.records, group.recurringFrequency || "Monthly");
  };

  const totalDuplicates = useMemo(
    () => duplicateGroups.reduce((sum, g) => sum + g.records.length - 1, 0),
    [duplicateGroups]
  );

  const columns = [
    {
      header: "",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleIdSelected(row.id)}
          className="w-4 h-4"
        />
      ),
    },
    {
      header: "Date",
      render: (row) => {
        const d = row.date ? new Date(row.date + "T00:00:00") : null;
        return d
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : row.date || "-";
      },
    },
    {
      header: "Description",
      render: (row) => (
        <span className="text-sm text-stone-700">{row.description || "-"}</span>
      ),
    },
    {
      header: "Amount",
      render: (row) => (
        <span className="font-medium text-stone-900">
          ${Math.abs(row.amount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Vendor",
      render: (row) => (
        <span className="text-xs text-stone-500">{row.vendor || "-"}</span>
      ),
    },
    {
      header: "Recurring",
      render: (row) =>
        row.is_recurring ? (
          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
            <RefreshCw className="w-3 h-3 mr-1" />
            {row.recurring_frequency || "Recurring"}
          </Badge>
        ) : (
          <span className="text-xs text-stone-400">—</span>
        ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-600" />
            Duplicate Review
          </DialogTitle>
          <DialogDescription>
            Found {duplicateGroups.length} group{duplicateGroups.length !== 1 ? "s" : ""} of duplicate
            transactions ({totalDuplicates} duplicate record{totalDuplicates !== 1 ? "s" : ""} to
            review). Review each group below — duplicates within a group share the same date, amount,
            and description.
          </DialogDescription>
        </DialogHeader>

        {duplicateGroups.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-stone-600 font-medium">No duplicates found</p>
            <p className="text-sm text-stone-400 mt-1">Your expense records are already clean.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Actions bar */}
            <div className="flex items-center justify-between bg-stone-50 rounded-lg p-3">
              <p className="text-sm text-stone-600">
                {selectedIds.size > 0
                  ? `${selectedIds.size} record${selectedIds.size !== 1 ? "s" : ""} selected for deletion`
                  : "Select individual records or use \"Select All Duplicates\""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllDuplicates}>
                  Select All Duplicates
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0 || deleting}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {deleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
                </Button>
              </div>
            </div>

            {/* Duplicate groups */}
            {duplicateGroups.map((group, idx) => (
              <div
                key={group.key}
                className={`border rounded-xl overflow-hidden ${
                  group.isRecurring ? "border-violet-200 bg-violet-50/30" : "border-stone-200"
                }`}
              >
                {/* Group header */}
                <button
                  onClick={() => toggleGroupExpanded(idx)}
                  className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        group.isRecurring
                          ? "bg-violet-100 text-violet-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {group.records.length}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {group.records[0]?.description || "Unknown"}
                      </p>
                      <p className="text-xs text-stone-500">
                        ${Math.abs(group.records[0]?.amount || 0).toFixed(2)} each —{" "}
                        {group.records.length} records with same date, amount & description
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.isRecurring ? (
                      <Badge
                        variant="outline"
                        className="bg-violet-50 text-violet-700 border-violet-200"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Likely Recurring
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Possible Duplicate
                      </Badge>
                    )}
                  </div>
                </button>

                {/* Group detail */}
                {expandedGroups.has(idx) && (
                  <div className="border-t border-stone-200">
                    {group.isRecurring && group.recurringHint && (
                      <div className="bg-violet-50 border-b border-violet-100 px-4 py-2 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-violet-600" />
                        <p className="text-sm text-violet-800">
                          <strong>Recurring detected:</strong> {group.recurringHint}. These may be
                          legitimate recurring charges, not duplicates. Consider marking as
                          recurring instead of deleting.
                        </p>
                      </div>
                    )}
                    {!group.isRecurring && (
                      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-sm text-amber-800">
                          These records share the same date, amount, and description — likely
                          duplicate imports. Select which ones to delete (we recommend keeping one).
                        </p>
                      </div>
                    )}
                    <DataTable columns={columns} data={group.records} />
                    {group.isRecurring && (
                      <div className="px-4 py-3 bg-violet-50/50 border-t border-violet-100 flex items-center justify-between">
                        <p className="text-sm text-violet-700">
                          These look like recurring charges across different months.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkRecurring(group)}
                          className="border-violet-300 text-violet-700 hover:bg-violet-100"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Mark All as Recurring
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}