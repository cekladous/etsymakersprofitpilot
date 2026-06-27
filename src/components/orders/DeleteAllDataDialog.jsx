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
      await base44.entities.EtsyOrder.deleteMany({ owner_user_id: user.id });
      await base44.entities.OrderFee.deleteMany({ owner_user_id: user.id });
      await base44.entities.Fee.deleteMany({ owner_user_id: user.id });
      await base44.entities.EtsyStatementLine.deleteMany({ owner_user_id: user.id });
      await base44.entities.EtsyStatementImport.deleteMany({ owner_user_id: user.id });
      await base44.entities.Transfer.deleteMany({ owner_user_id: user.id, type: "etsy_deposit" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-fees"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-statement-lines"] });
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
            Delete All Etsy Data
          </DialogTitle>
          <DialogDescription>
            This will permanently delete ALL Etsy orders, fees, deposits, and statement imports.
            This cannot be undone. You'll need to re-import your Etsy statement afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <p className="text-sm text-rose-800 font-medium">The following will be deleted:</p>
            <ul className="text-sm text-rose-700 mt-2 space-y-1 ml-4 list-disc">
              <li>All Etsy orders</li>
              <li>All order fee summaries (transaction, processing, etc.)</li>
              <li>All individual fee line items</li>
              <li>All Etsy deposits/transfers</li>
              <li>All statement import records and raw statement lines</li>
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