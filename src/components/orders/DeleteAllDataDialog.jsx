import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

export default function DeleteAllDataDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();

      // Every user-owned entity in the app schema (32 entities).
      // Global/system entities (FeeChangeLog, PricingPlan, PromoCode, User) are NOT deleted.
      const entitiesToDelete = [
        { name: 'EtsyOrder', filter: { owner_user_id: user.id } },
        { name: 'OrderFee', filter: { owner_user_id: user.id } },
        { name: 'Fee', filter: { owner_user_id: user.id } },
        { name: 'EtsyStatementLine', filter: { owner_user_id: user.id } },
        { name: 'EtsyStatementImport', filter: { owner_user_id: user.id } },
        { name: 'EtsyLedgerEntry', filter: { owner_user_id: user.id } },
        { name: 'EtsyDeposit', filter: { owner_user_id: user.id } },
        { name: 'Transfer', filter: { owner_user_id: user.id } },
        { name: 'TransactionLink', filter: { owner_user_id: user.id } },
        { name: 'OrderImportBatch', filter: { owner_user_id: user.id } },
        { name: 'Order', filter: { owner_user_id: user.id } },
        { name: 'CustomSale', filter: { owner_user_id: user.id } },
        { name: 'Customer', filter: { owner_user_id: user.id } },
        { name: 'Product', filter: { owner_user_id: user.id } },
        { name: 'Invoice', filter: { owner_user_id: user.id } },
        { name: 'Quote', filter: { owner_user_id: user.id } },
        { name: 'BusinessExpense', filter: { owner_user_id: user.id } },
        { name: 'Expense', filter: { owner_user_id: user.id } },
        { name: 'InventoryItem', filter: { owner_user_id: user.id } },
        { name: 'InventoryTransaction', filter: { owner_user_id: user.id } },
        { name: 'MaterialType', filter: { owner_user_id: user.id } },
        { name: 'MaterialSheet', filter: { owner_user_id: user.id } },
        { name: 'MaterialPurchase', filter: { owner_user_id: user.id } },
        { name: 'MaterialUsage', filter: { owner_user_id: user.id } },
        { name: 'Job', filter: { owner_user_id: user.id } },
        { name: 'Machine', filter: { owner_user_id: user.id } },
        { name: 'LaserSetting', filter: { owner_user_id: user.id } },
        { name: 'MonthClosed', filter: { owner_user_id: user.id } },
        { name: 'BudgetPlan', filter: { owner_user_id: user.id } },
        { name: 'BudgetLine', filter: { owner_user_id: user.id } },
        { name: 'Settings', filter: { owner_user_id: user.id } },
        { name: 'Subscription', filter: { owner_user_id: user.id } },
      ];

      // Retry helper with exponential backoff: 500ms, 1000ms, 2000ms (3 retries)
      const deleteWithRetry = async (entityName, filter, maxRetries = 3) => {
        const delays = [500, 1000, 2000];
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await base44.entities[entityName].deleteMany(filter);
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, delays[attempt] || 2000));
            }
          }
        }
        throw lastError;
      };

      // Promise.allSettled ensures ALL entities are attempted even if one fails.
      // Each delete is staggered by 300ms to prevent rate limiting.
      const deletePromises = entitiesToDelete.map(({ name, filter }, index) =>
        (async () => {
          await new Promise(r => setTimeout(r, index * 300));
          return deleteWithRetry(name, filter);
        })()
      );

      const results = await Promise.allSettled(deletePromises);
      const failures = results
        .map((r, i) =>
          r.status === 'rejected'
            ? `${entitiesToDelete[i].name}: ${r.reason?.message || r.reason}`
            : null
        )
        .filter(Boolean);

      if (failures.length > 0) {
        throw new Error(`Some deletions failed: ${failures.join('; ')}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      onOpenChange(false);
      setConfirmText("");
    },
    onError: (error) => {
      console.error("Delete all data failed:", error);
      alert("Failed to delete all data: " + error.message);
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setConfirmText("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            Delete All Data
          </DialogTitle>
          <DialogDescription>
            This will permanently delete ALL data in your account — orders, fees, deposits,
            customers, products, invoices, quotes, expenses, inventory, materials, jobs,
            machines, settings, and subscriptions. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 max-h-48 overflow-y-auto">
            <p className="text-sm text-rose-800 font-medium">The following will be deleted:</p>
            <ul className="text-sm text-rose-700 mt-2 space-y-0.5 ml-4 list-disc">
              <li>All Etsy orders, fees, deposits, and statement data</li>
              <li>All custom sales and customers</li>
              <li>All products and inventory items</li>
              <li>All invoices and quotes</li>
              <li>All business expenses and transactions</li>
              <li>All materials, sheets, and purchases</li>
              <li>All production jobs and machines</li>
              <li>All laser settings and material types</li>
              <li>All budget plans and month closures</li>
              <li>All settings and subscription records</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-700">
              Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              placeholder="DELETE"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmText !== "DELETE" || deleteAllMutation.isPending}
            onClick={() => deleteAllMutation.mutate()}
          >
            {deleteAllMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}