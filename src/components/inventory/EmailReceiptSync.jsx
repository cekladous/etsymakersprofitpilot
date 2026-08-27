import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Plus, RefreshCw, Trash2, CheckCircle2, XCircle, Link2, Link2Off, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const CONNECTORS = [
  { provider: "gmail", name: "Gmail #1", connectorId: "6a90536b527c34d0e2918006" },
  { provider: "gmail", name: "Gmail #2", connectorId: "6a905af2b42218b7bcc16641" },
  { provider: "gmail", name: "Gmail #3", connectorId: "6a905aff4d2d942c728645ba" },
  { provider: "outlook", name: "Outlook", connectorId: "6a9053754cf3bedc66182209" },
];

const STALE_MS = 15 * 60 * 1000;

export default function EmailReceiptSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const autoSynced = useRef(false);

  const [status, setStatus] = useState({}); // keyed by connectorId
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", match_value: "" });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["receipt-suppliers", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.ReceiptSupplier.filter({ owner_user_id: user.id }, "-created_date", 200),
  });

  const { data: syncStates = [] } = useQuery({
    queryKey: ["email-sync-states", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.EmailSyncState.filter({ owner_user_id: user.id }, "-last_sync_at", 50),
  });

  const probeProvider = async (connectorId) => {
    const c = CONNECTORS.find((x) => x.connectorId === connectorId);
    try {
      const res = await base44.functions.invoke("syncReceiptsFromEmail", {
        provider: c.provider, connectorId, dryRun: true,
      });
      const st = (syncStates || []).find((s) => s.connector_id === connectorId);
      setStatus((prev) => ({
        ...prev,
        [connectorId]: {
          connected: res.data?.connected === true,
          syncing: false,
          lastSync: st?.last_sync_at || null,
          lastCount: st?.last_imported_count ?? 0,
        },
      }));
      return res.data?.connected === true;
    } catch {
      setStatus((prev) => ({ ...prev, [connectorId]: { connected: false, syncing: false } }));
      return false;
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const connectedMap = {};
      for (const c of CONNECTORS) {
        connectedMap[c.connectorId] = await probeProvider(c.connectorId);
      }
      if (cancelled) return;
      if (!autoSynced.current) {
        autoSynced.current = true;
        for (const c of CONNECTORS) {
          if (connectedMap[c.connectorId]) {
            const st = (syncStates || []).find((s) => s.connector_id === c.connectorId);
            const stale = !st?.last_sync_at || Date.now() - new Date(st.last_sync_at).getTime() > STALE_MS;
            if (stale) runSync(c.provider, c.connectorId, true);
          }
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const runSync = async (provider, connectorId, auto = false) => {
    setStatus((prev) => ({ ...prev, [connectorId]: { ...(prev[connectorId] || {}), syncing: true } }));
    try {
      const res = await base44.functions.invoke("syncReceiptsFromEmail", { provider, connectorId });
      const d = res.data || {};
      const label = CONNECTORS.find((x) => x.connectorId === connectorId)?.name || provider;
      if (auto) {
        if (d.imported > 0) toast({ title: `📧 ${label}: ${d.imported} receipt(s) imported` });
      } else {
        toast({
          title: d.imported > 0
            ? `Imported ${d.imported} receipt(s) from ${label}`
            : `No new receipts found (scanned ${d.scanned || 0})`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["material-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["email-sync-states"] });
    } catch (e) {
      if (!auto) toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      await probeProvider(connectorId);
    }
  };

  const handleConnect = async (provider, connectorId) => {
    try {
      const url = await base44.connectors.connectAppUser(connectorId);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          probeProvider(connectorId);
        }
      }, 600);
    } catch (e) {
      toast({ title: "Connect failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDisconnect = async (provider, connectorId) => {
    try {
      await base44.connectors.disconnectAppUser(connectorId);
      setStatus((prev) => ({ ...prev, [connectorId]: { connected: false, syncing: false } }));
      const label = CONNECTORS.find((x) => x.connectorId === connectorId)?.name || provider;
      toast({ title: `Disconnected ${label}` });
    } catch (e) {
      toast({ title: "Disconnect failed", description: e.message, variant: "destructive" });
    }
  };

  const addSupplierMutation = useMutation({
    mutationFn: (data) => base44.entities.ReceiptSupplier.create({
      owner_user_id: user.id,
      name: data.name,
      match_value: data.match_value,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-suppliers"] });
      setNewSupplier({ name: "", match_value: "" });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (id) => base44.entities.ReceiptSupplier.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["receipt-suppliers"] }),
  });

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Mail className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900">Auto-import receipts from email</h3>
              <p className="text-sm text-stone-500">Connect up to 3 Gmail inboxes + Outlook — incoming purchase receipts become inventory &amp; purchases automatically.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CONNECTORS.map((c) => {
            const st = status[c.connectorId] || {};
            return (
              <div key={c.connectorId} className="border border-stone-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-stone-800">{c.name}</span>
                  {st.connected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" /> On
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">
                      <XCircle className="w-3 h-3" /> Off
                    </span>
                  )}
                </div>
                {st.lastSync && (
                  <p className="text-xs text-stone-400 mb-2">
                    {new Date(st.lastSync).toLocaleString()} · {st.lastCount} in
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {st.connected ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => runSync(c.provider, c.connectorId)}
                        disabled={st.syncing}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {st.syncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                        Sync
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDisconnect(c.provider, c.connectorId)}>
                        <Link2Off className="w-4 h-4 mr-1.5" />
                        Off
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleConnect(c.provider, c.connectorId)}>
                      <Link2 className="w-4 h-4 mr-1.5" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowSuppliers((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-stone-700 hover:text-stone-900"
          >
            {showSuppliers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Known suppliers ({suppliers.length})
          </button>
          {showSuppliers && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-stone-500">
                Emails from these senders (or domains) are always imported. Other emails are still scanned for receipt keywords and AI-confirmed before importing.
              </p>
              <form
                onSubmit={(e) => { e.preventDefault(); if (newSupplier.name && newSupplier.match_value) addSupplierMutation.mutate(newSupplier); }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <Input
                  placeholder="Supplier name (e.g. Houston Acrylic)"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))}
                  className="flex-1"
                />
                <Input
                  placeholder="Email or domain (e.g. houstonacrylic.com)"
                  value={newSupplier.match_value}
                  onChange={(e) => setNewSupplier((s) => ({ ...s, match_value: e.target.value }))}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={!newSupplier.name || !newSupplier.match_value || addSupplierMutation.isPending}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </form>
              <div className="space-y-1.5">
                {suppliers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border border-stone-200 rounded-lg px-3 py-2 bg-white">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-stone-800">{s.name}</span>
                      <span className="text-xs text-stone-500 ml-2">{s.match_value}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => deleteSupplierMutation.mutate(s.id)} className="text-rose-600 h-8 w-8 p-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {suppliers.length === 0 && (
                  <p className="text-xs text-stone-400">No suppliers added yet — keyword + AI scanning still catches receipts.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}