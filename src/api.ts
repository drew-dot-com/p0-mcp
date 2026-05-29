/**
 * Thin client over P0's public read-only HTTP APIs (no key, no wallet).
 * See: https://ai.0.xyz/api/{banks,strategies,wallet/:address}
 */

const BASE = "https://ai.0.xyz";

export type Bank = {
  bank_address: string;
  symbol: string;
  mint: string;
  mint_decimals: number;
  venue: "P0" | "Kamino" | "Drift" | string;
  deposit_apy: number;
  borrow_apy: number;
  usd_price: number;
  market?: string;
  // marginfi risk weights (used for health / margin math)
  asset_weight_init: number;
  asset_weight_maint: number;
  liability_weight_init: number;
  liability_weight_maint: number;
};

/** A single supply/borrow strategy leg as returned in each category array. */
export type RawStrategy = {
  supplyMint: string;
  supplySymbol: string;
  borrowMint: string;
  borrowSymbol: string;
  supplyBank: string;
  borrowBank: string;
  supplyVenue: string;
  borrowVenue: string;
  lendApy: number;
  borrowApy: number;
  netApyBase: number;
  maxLeverage: number;
  netApyAtMaxLeverage: number;
  availableStrategySizeUsd: number;
  bindingConstraint: string;
  emodeApplied: boolean;
};

/** Grouped strategies response from /api/strategies (mirrors api.0.xyz/v0/strategies). */
export type StrategiesResponse = {
  asOf: string;
  sortBy: string;
  // Non-directional categories (stablecoins, solLst) are arrays of strategies.
  strategies: Record<string, RawStrategy[]>;
  // Directional categories (eth, btc, sol, jlp) are objects keyed by side (long/short).
  directional: Record<string, Record<string, RawStrategy>>;
};

/** Flattened strategy with category, directional flag, and optional side. */
export type FlatStrategy = RawStrategy & {
  category: string;
  directional: boolean;
  side?: string; // "long" | "short" for directional strategies
};

export type WalletToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  usd_price: number;
  usd_value: number;
};

export type WalletResponse = {
  wallet: string;
  total_usd_value: number;
  tokens: WalletToken[];
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(
      `P0 API error (${res.status} ${res.statusText}) for ${path}`,
    );
  }
  return res.json() as Promise<T>;
}

export const getBanks = () => getJson<Bank[]>("/api/banks");
export const getWallet = (address: string) =>
  getJson<WalletResponse>(`/api/wallet/${encodeURIComponent(address)}`);

/** Fetch strategies and flatten the grouped response into a single tagged list. */
export async function getStrategies(): Promise<{
  asOf: string;
  sortBy: string;
  strategies: FlatStrategy[];
}> {
  const res = await getJson<StrategiesResponse>("/api/strategies");
  const flat: FlatStrategy[] = [];

  // Non-directional: each category value is an array of strategies.
  for (const [category, arr] of Object.entries(res.strategies ?? {})) {
    if (!Array.isArray(arr)) continue;
    for (const s of arr) flat.push({ ...s, category, directional: false });
  }
  // Directional: each category value is an object keyed by side (long/short).
  for (const [category, sides] of Object.entries(res.directional ?? {})) {
    if (!sides || typeof sides !== "object") continue;
    for (const [side, s] of Object.entries(sides)) {
      if (s) flat.push({ ...s, category, directional: true, side });
    }
  }

  flat.sort((a, b) => b.netApyAtMaxLeverage - a.netApyAtMaxLeverage);
  return { asOf: res.asOf, sortBy: res.sortBy, strategies: flat };
}
