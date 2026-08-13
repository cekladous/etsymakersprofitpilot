import React, { useState, useRef } from "react";
import { Loader2, ChevronDown } from "lucide-react";

const THRESHOLD = 70;

// Native-like pull-to-refresh for mobile WebView. Wraps page content;
// triggers `onRefresh` when the user pulls down from the top of the page.
export default function PullToRefresh({ onRefresh, children, disabled }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);

  const isMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

  const handleTouchStart = (e) => {
    if (disabled || refreshing) return;
    if (!isMobile()) return;
    // Only start a pull when the page is scrolled to the very top
    const scrollTop =
      document.scrollingElement?.scrollTop || document.body.scrollTop || 0;
    if (scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = false;
  };

  const handleTouchMove = (e) => {
    if (startY.current === null || disabled || refreshing) return;
    const y = e.touches[0].clientY;
    const diff = y - startY.current;
    if (diff > 10 && !pulling.current) pulling.current = true;
    if (pulling.current) {
      // Dampen the pull so it feels springy
      setPullDistance(Math.min(diff * 0.5, THRESHOLD));
    }
  };

  const handleTouchEnd = async () => {
    if (pulling.current && pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    startY.current = null;
    pulling.current = false;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      <div
        style={{ height: pullDistance, overflow: "hidden" }}
        className="flex items-center justify-center"
      >
        {refreshing ? (
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        ) : pullDistance > 10 ? (
          <ChevronDown
            className="w-5 h-5 text-stone-400 transition-transform"
            style={{ transform: `rotate(${pullDistance >= THRESHOLD ? 180 : 0}deg)` }}
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}