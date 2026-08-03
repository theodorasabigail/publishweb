import type { LoyaltyTier, SiteSettings } from "@/lib/types";

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export const TIER_STYLES: Record<LoyaltyTier, string> = {
  bronze: "bg-bark-100 text-bark-800",
  silver: "bg-slate-200 text-slate-800",
  gold: "bg-amber-200 text-amber-900",
};

export interface TierProgress {
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNext: number;
  /** 0-100, for the dashboard progress bar. */
  percent: number;
}

export function pointsForSpend(totalIdr: number, rupiahPerPoint: number): number {
  const rate = Math.max(1, rupiahPerPoint);
  return Math.floor(totalIdr / rate);
}

export function tierProgress(
  lifetimePoints: number,
  settings: Pick<SiteSettings, "tier_silver_threshold" | "tier_gold_threshold">,
): TierProgress {
  const silver = settings.tier_silver_threshold;
  const gold = settings.tier_gold_threshold;

  if (lifetimePoints >= gold) {
    return { tier: "gold", nextTier: null, pointsToNext: 0, percent: 100 };
  }

  if (lifetimePoints >= silver) {
    const span = Math.max(1, gold - silver);
    return {
      tier: "silver",
      nextTier: "gold",
      pointsToNext: gold - lifetimePoints,
      percent: Math.round(((lifetimePoints - silver) / span) * 100),
    };
  }

  return {
    tier: "bronze",
    nextTier: "silver",
    pointsToNext: silver - lifetimePoints,
    percent: Math.round((lifetimePoints / Math.max(1, silver)) * 100),
  };
}
