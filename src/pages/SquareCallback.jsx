import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function SquareCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Exchanging authorization with Square…");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        navigate(`/Settings?square_error=${encodeURIComponent(error)}`, { replace: true });
        return;
      }
      if (!code || !state) {
        navigate(`/Settings?square_error=missing_params`, { replace: true });
        return;
      }

      try {
        setStatus("Linking your Square account…");
        const res = await base44.functions.invoke("squareOAuthCallback", { code, state });
        const data = res.data || res;
        if (data && data.error) {
          const detail = [
            data.error,
            data.square_message && `Square: ${data.square_message}`,
            data.square_error && `(${data.square_error})`,
          ].filter(Boolean).join(" ");
          navigate(`/Settings?square_error=${encodeURIComponent(detail)}`, { replace: true });
          return;
        }
        navigate(`/Settings?square_connected=1`, { replace: true });
      } catch (err) {
        navigate(
          `/Settings?square_error=${encodeURIComponent(err?.message || "callback_failed")}`,
          { replace: true }
        );
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-stone-600 dark:text-stone-300">
      <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
      <p className="text-sm font-medium">{status}</p>
    </div>
  );
}