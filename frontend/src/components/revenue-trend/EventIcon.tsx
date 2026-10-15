import { TrendingDown, TrendingUp } from "lucide-react";
import type { EventImpact } from "@/lib/types";

// Hex values (not CSS classes) so the colour survives inside the SVG chart and in the exported PNG.
export const IMPACT_COLOR: Record<EventImpact, string> = { positive: "#16a34a", negative: "#dc2626" };

export function EventIcon({ impact, size = 14, color }: { impact: EventImpact; size?: number; color?: string }) {
  const Icon = impact === "positive" ? TrendingUp : TrendingDown;
  return <Icon size={size} strokeWidth={2.25} color={color ?? IMPACT_COLOR[impact]} aria-hidden />;
}
