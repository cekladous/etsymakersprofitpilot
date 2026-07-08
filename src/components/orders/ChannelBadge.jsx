import React from "react";
import { getChannelLabel } from "@/components/shared/channelUtils";

/**
 * Small badge showing the sales channel (e.g. "In-Person (Square)")
 * for non-standard order channels. Renders nothing for regular online orders.
 */
export default function ChannelBadge({ order }) {
  const channel = getChannelLabel(order);
  if (!channel) return null;

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
      channel.variant === 'square'
        ? 'bg-violet-100 text-violet-700'
        : 'bg-stone-100 text-stone-600'
    }`}>
      {channel.label}
    </span>
  );
}