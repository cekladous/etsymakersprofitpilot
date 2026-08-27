import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, CheckCircle2, Link2, Loader2, ShieldCheck, RefreshCw, Unlink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function EtsyConnectCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { data: connection, isLoading } = useQuery({
    queryKey: ["etsy-connection", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const conns = await base44.entities.EtsyConnection.filter({
        owner_user_id: user.id,
        status: "active",
      });
      return conns && conns[0];
    },
  });

  // Handle the redirect-back query params set by the EtsyCallback page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("etsy_connected");
    const error = params.get("etsy_error");
    if (connected) {
      queryClient.invalidateQueries({ queryKey: ["etsy-connection"] });
      toast({ title: "Etsy connected", description: "Your shop is now linked. Orders will import hourly." });
    }
    if (error) {
      toast({ title: "Etsy connection failed", description: error, variant: "destructive" });
    }
    if (connected || error) {
      params.delete("etsy_connected");
      params.delete("etsy_error");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? "?" + qs : ""}`);
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("etsyOAuthStart", {});
      const data = res.data || res;
      if (data.already_connected) {
        toast({ title: "Already connected", description: "Your Etsy shop is already linked." });
        queryClient.invalidateQueries({ queryKey: ["etsy-connection"] });
        return;
      }
      if (!data.url) throw new Error("No authorization URL returned");
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Could not start Etsy connection",
        description: err?.message || String(err),
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("importEtsyOrders", { owner_user_id: user.id });
      const data = res.data || res;
      const count = data?.syncs?.[0]?.imported ?? 0;
      queryClient.invalidateQueries({ queryKey: ["etsy-connection"] });
      toast({ title: "Etsy sync complete", description: `${count} new order(s) imported.` });
    } catch (err) {
      toast({ title: "Etsy sync failed", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Etsy shop? Hourly auto-import stops until you reconnect.")) return;
    setDisconnecting(true);
    try {
      await base44.functions.invoke("etsyDisconnect", {});
      queryClient.invalidateQueries({ queryKey: ["etsy-connection"] });
      toast({ title: "Etsy disconnected", description: "Your shop is no longer linked." });
    } catch (err) {
      toast({ title: "Disconnect failed", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = !!connection;
  const lastSync = connection?.last_sync_at
    ? new Date(connection.last_sync_at).toLocaleString()
    : null;

  return (
    <Card className="border-stone-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-orange-600" />
            <CardTitle className="text-lg">Etsy Shop</CardTitle>
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
                Linked to <strong>{connection.shop_name || connection.shop_id || "your Etsy shop"}</strong>.
                New orders import automatically every hour.
              </p>
            </div>
            <div className="text-xs text-stone-600 space-y-1">
              {lastSync && (
                <p>Last sync: <span className="font-medium">{lastSync}</span> — {connection.last_imported_count ?? 0} new order(s).</p>
              )}
              {connection.last_error && (
                <p className="text-red-600">Last error: {connection.last_error}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleSyncNow} disabled={syncing}>
                {syncing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing…</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Sync now</>
                )}
              </Button>
              <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? "Disconnecting…" : (<><Unlink className="w-4 h-4 mr-2" /> Disconnect</>)}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              Connect <strong>your own</strong> Etsy shop once and Profit Pilot pulls new orders
              automatically every hour — no more monthly CSV uploads. Fees are estimated from your
              configured rates, and expected deposits are derived from your net sales.
            </p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-xs text-stone-600">
              <p className="font-semibold text-stone-700">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click <strong>Connect Etsy</strong> below.</li>
                <li>Etsy asks you to approve Profit Pilot for your shop.</li>
                <li>You're returned here — your shop is linked.</li>
                <li>New orders import hourly; use <strong>Sync now</strong> for an immediate pull.</li>
              </ol>
            </div>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to Etsy…</>
              ) : (
                <><Link2 className="w-4 h-4 mr-2" /> Connect Etsy</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}