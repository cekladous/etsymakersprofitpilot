import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, CheckCircle2, Link2, Loader2, ShieldCheck, RefreshCw, AlertTriangle, Webhook } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

// Scopes the payment sync depends on. A connection granted before the sync
// existed lacks them, so we ask the seller to reconnect.
const REQUIRED_SCOPES = ["PAYMENTS_READ", "ORDERS_READ", "INVOICES_READ", "CUSTOMERS_READ", "MERCHANT_PROFILE_READ"];

const hasRequiredScopes = (connection) => {
  const granted = String(connection?.scopes || "").split(/[\s,]+/).filter(Boolean);
  if (granted.length === 0) return false;
  return REQUIRED_SCOPES.every((scope) => granted.includes(scope));
};

export default function SquareConnectCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { data: connection, isLoading } = useQuery({
    queryKey: ["square-connection", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const conns = await base44.entities.SquareConnection.filter({
        owner_user_id: user.id,
        status: "active",
      });
      return conns && conns[0];
    },
  });

  // After Square redirects back to /Settings?square_connected=1 (or square_error=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("square_connected");
    const error = params.get("square_error");
    if (connected) {
      queryClient.invalidateQueries({ queryKey: ["square-connection"] });
      toast({ title: "Square connected", description: "Your Square account is now linked." });
    }
    if (error) {
      toast({
        title: "Square connection failed",
        description: error,
        variant: "destructive",
      });
    }
    if (connected || error) {
      params.delete("square_connected");
      params.delete("square_error");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? "?" + qs : ""}`);
    }
  }, []);

  const startOAuth = async (force) => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("squareOAuthStart", { force: !!force });
      const data = res.data || res;
      if (data.already_connected) {
        toast({ title: "Already connected", description: "Your Square account is already linked." });
        setConnecting(false);
        return;
      }
      if (!data.url) throw new Error("No authorization URL returned");
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Could not start Square connection",
        description: err?.message || String(err),
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Square account? Invoices will no longer push or sync until you reconnect.")) return;
    setDisconnecting(true);
    try {
      await base44.functions.invoke("squareDisconnect", {});
      queryClient.invalidateQueries({ queryKey: ["square-connection"] });
      toast({ title: "Square disconnected", description: "Your Square account is no longer linked." });
    } catch (err) {
      toast({
        title: "Disconnect failed",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("squareSync", { days: 60 });
      const data = res.data || res;
      const stats = data?.results?.[0]?.stats;
      if (!data.ok && !stats) {
        throw new Error(data?.results?.[0]?.error || data?.message || "Sync failed");
      }
      queryClient.invalidateQueries({ queryKey: ["square-connection"] });
      queryClient.invalidateQueries({ queryKey: ["etsy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["custom-sales"] });
      queryClient.invalidateQueries({ queryKey: ["business-expenses"] });
      toast({
        title: "Square payments synced",
        description: `${stats?.payments_scanned || 0} payments checked · ${stats?.linked_to_etsy || 0} linked to Etsy · ${stats?.new_custom_sales || 0} new Square sales · $${Number(stats?.fees_total || 0).toFixed(2)} in fees`,
      });
    } catch (err) {
      toast({
        title: "Square sync failed",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleVerifyWebhook = async () => {
    setVerifying(true);
    try {
      const res = await base44.functions.invoke("squareWebhookSetup", {});
      const data = res.data || res;
      if (data.registered) {
        toast({
          title: "Webhook active",
          description: "Square sends payment, refund and invoice events to Profit Pilot.",
        });
      } else if (data.needs_manual_setup) {
        toast({
          title: "Webhook needs setup in Square",
          description: "Reconnect Square to grant webhook access, or add the webhook in the Square Developer Console. The hourly sync keeps data current either way.",
        });
      } else {
        toast({
          title: "Webhook not registered",
          description: data.error || "Square did not confirm the subscription.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Could not verify webhook",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const connected = !!connection;
  const needsReconnect = connected && !hasRequiredScopes(connection);

  return (
    <Card className="border-stone-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Square className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-lg">Square Account</CardTitle>
          </div>
          {connected ? (
            <Badge className="bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-stone-100 text-stone-500">Not Connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
          </div>
        ) : connected ? (
          <>
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-800">
                Linked to <strong>{connection.merchant_name || connection.merchant_id || "your Square account"}</strong>.
              </p>
            </div>

            {needsReconnect && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-amber-900">
                    This connection is missing the permissions the payment sync needs. Reconnect Square to grant
                    payments, orders, invoices and customer read access.
                  </p>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => startOAuth(true)}
                    disabled={connecting}
                  >
                    {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Reconnect Square
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-stone-200 p-3 space-y-1 text-xs text-stone-600">
              <p>
                <span className="font-semibold text-stone-700">Last sync:</span>{" "}
                {connection.last_sync_at
                  ? format(new Date(connection.last_sync_at), "MMM d, yyyy h:mm a")
                  : "Never synced"}
              </p>
              {connection.last_imported_count > 0 && (
                <p><span className="font-semibold text-stone-700">Last run:</span> {connection.last_imported_count} payment(s) recorded</p>
              )}
              {connection.last_error && (
                <p className="text-rose-600"><span className="font-semibold">Last error:</span> {connection.last_error}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleSyncNow} disabled={syncing}>
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {syncing ? "Syncing…" : "Sync payments now"}
              </Button>
              <Button variant="outline" onClick={handleVerifyWebhook} disabled={verifying}>
                {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Webhook className="w-4 h-4 mr-2" />}
                Verify webhook
              </Button>
            </div>

            <Button variant="ghost" className="w-full text-stone-600" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? "Disconnecting..." : "Disconnect Square"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              Connect <strong>your own</strong> Square account so invoices you push go to your Square, and payments
              sync back here automatically. Each seller links their own account — your data never touches anyone
              else's.
            </p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-xs text-stone-600">
              <p className="font-semibold text-stone-700">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click <strong>Connect Square</strong> below.</li>
                <li>Square asks you to approve Profit Pilot for your account.</li>
                <li>You're returned here — your account is linked.</li>
                <li>Payments sync hourly; Square sales already in Etsy are linked, not double counted.</li>
              </ol>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => startOAuth(false)}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to Square…
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" /> Connect Square
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}