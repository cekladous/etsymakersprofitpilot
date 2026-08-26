import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, CheckCircle2, Link2, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function SquareConnectCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("squareOAuthStart", {});
      const data = res.data || res;
      if (data.already_connected) {
        toast({ title: "Already connected", description: "Your Square account is already linked." });
        return;
      }
      if (!data.url) throw new Error("No authorization URL returned");
      // Full redirect — Square sends the user back to /Settings after consent
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

  const connected = !!connection;

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
                Invoices you push go to <strong>your</strong> Square only — never anyone else's. When a customer pays
                the Square invoice, it's marked Paid here automatically.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleDisconnect} disabled={disconnecting}>
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
                <li>Push invoices from the Invoices page; payments sync automatically.</li>
              </ol>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConnect}
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