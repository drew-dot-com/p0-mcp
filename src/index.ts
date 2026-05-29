#!/usr/bin/env node
/**
 * p0-mcp — Model Context Protocol server for the Project 0 (P0) Solana credit protocol.
 *
 * Exposes four read-only tools any MCP-compatible client (Claude Desktop, Cursor,
 * Cline, Zed, Continue, etc.) can call to query live P0 data.
 *
 * v1 is read-only: no keypair, no signing, no on-chain writes.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getBanks,
  getStrategies,
  getWallet,
  type Bank,
  type WalletToken,
} from "./api.js";

const server = new McpServer({
  name: "p0-mcp",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool 1: get_banks
// ---------------------------------------------------------------------------

server.tool(
  "get_banks",
  "List P0 lending pools (banks) across all venues (P0, Kamino, Drift) with " +
    "current deposit and borrow APYs. Use this to find the best yield for a " +
    "token, or to find the cheapest stablecoin to borrow. Filter by `venue` " +
    "or `symbol` to narrow results. Borrowing is only available on banks " +
    "where venue === 'P0'.",
  {
    venue: z
      .enum(["P0", "Kamino", "Drift"])
      .optional()
      .describe("Filter to a single lending venue."),
    symbol: z
      .string()
      .optional()
      .describe("Filter by token symbol (e.g. 'USDC', 'SOL', 'bbSOL')."),
    sort_by: z
      .enum(["deposit_apy", "borrow_apy"])
      .optional()
      .default("deposit_apy")
      .describe("Sort field. Default deposit_apy descending."),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(20)
      .describe("Maximum number of banks to return."),
  },
  async ({ venue, symbol, sort_by, limit }) => {
    let banks = await getBanks();

    if (venue) banks = banks.filter((b) => b.venue === venue);
    if (symbol) {
      const s = symbol.toUpperCase();
      banks = banks.filter((b) => b.symbol.toUpperCase() === s);
    }

    banks.sort((a, b) =>
      sort_by === "borrow_apy"
        ? a.borrow_apy - b.borrow_apy
        : b.deposit_apy - a.deposit_apy,
    );

    return jsonResult(banks.slice(0, limit));
  },
);

// ---------------------------------------------------------------------------
// Tool 2: get_strategies
// ---------------------------------------------------------------------------

server.tool(
  "get_strategies",
  "List the top pre-computed yield strategies on P0 (rate-arbitrage and " +
    "looping setups), sorted by net APY at max leverage descending. Each " +
    "strategy is a supply-bank + borrow-bank pair tagged with a category " +
    "(stablecoins, solLst) and whether it is directional (eth, btc, sol, " +
    "jlp). Use `supplyBank` as the deposit bank and `borrowBank` as the " +
    "borrow bank; only 'project-0' venue banks are valid for borrows.",
  {
    category: z
      .string()
      .optional()
      .describe(
        "Filter to a single category, e.g. 'stablecoins', 'solLst', 'eth', 'btc', 'sol', 'jlp'.",
      ),
    directional: z
      .boolean()
      .optional()
      .describe(
        "If set, return only directional (true) or only non-directional (false) strategies.",
      ),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(10)
      .describe("Maximum number of strategies to return."),
  },
  async ({ category, directional, limit }) => {
    const { asOf, sortBy, strategies } = await getStrategies();

    let filtered = strategies;
    if (category) {
      const c = category.toLowerCase();
      filtered = filtered.filter((s) => s.category.toLowerCase() === c);
    }
    if (directional !== undefined) {
      filtered = filtered.filter((s) => s.directional === directional);
    }

    return jsonResult({
      asOf,
      sortBy,
      count: filtered.length,
      strategies: filtered.slice(0, limit),
    });
  },
);

// ---------------------------------------------------------------------------
// Tool 3: analyze_wallet
// ---------------------------------------------------------------------------

server.tool(
  "analyze_wallet",
  "Analyze a Solana wallet's holdings against current P0 yields. Returns " +
    "the wallet's tokens, the best deposit APY available on P0 for each " +
    "holding, and the projected annual yield in USD if the user deposited " +
    "everything. No wallet connection required — read-only.",
  {
    address: z
      .string()
      .min(32)
      .max(44)
      .describe("The Solana wallet address to analyze (base58)."),
  },
  async ({ address }) => {
    const [wallet, banks] = await Promise.all([
      getWallet(address),
      getBanks(),
    ]);

    const banksByMint = new Map<string, Bank>();
    for (const b of banks) {
      const existing = banksByMint.get(b.mint);
      if (!existing || b.deposit_apy > existing.deposit_apy) {
        banksByMint.set(b.mint, b);
      }
    }

    const analysis = wallet.tokens.map((t) => {
      const bank = banksByMint.get(t.address);
      const eligible = !!bank;
      const apy = bank?.deposit_apy ?? 0;
      const projectedAnnualYieldUsd = eligible ? (t.usd_value * apy) / 100 : 0;
      return {
        symbol: t.symbol,
        balance: t.balance,
        usd_value: t.usd_value,
        eligible_for_p0: eligible,
        best_deposit_apy: apy,
        best_venue: bank?.venue ?? null,
        bank_address: bank?.bank_address ?? null,
        projected_annual_yield_usd: round(projectedAnnualYieldUsd, 2),
      };
    });

    const totalEligibleUsd = analysis
      .filter((a) => a.eligible_for_p0)
      .reduce((sum, a) => sum + a.usd_value, 0);
    const totalProjectedYieldUsd = analysis.reduce(
      (sum, a) => sum + a.projected_annual_yield_usd,
      0,
    );

    return jsonResult({
      wallet: wallet.wallet,
      total_usd_value: wallet.total_usd_value,
      total_eligible_usd: round(totalEligibleUsd, 2),
      total_projected_annual_yield_usd: round(totalProjectedYieldUsd, 2),
      holdings: analysis,
    });
  },
);

// ---------------------------------------------------------------------------
// Tool 4: find_idle_capital
// ---------------------------------------------------------------------------

server.tool(
  "find_idle_capital",
  "Opinionated analysis of how much annual yield a wallet is leaving on the " +
    "table by holding idle assets that could be earning on P0. Returns a " +
    "concrete recommendation per idle holding: how much, in which bank, and " +
    "the dollar/year impact. Surfaces the single highest-impact action first.",
  {
    address: z
      .string()
      .min(32)
      .max(44)
      .describe("The Solana wallet address to inspect."),
    min_usd_value: z
      .number()
      .positive()
      .optional()
      .default(10)
      .describe("Ignore holdings below this USD value (filters dust)."),
  },
  async ({ address, min_usd_value }) => {
    const [wallet, banks] = await Promise.all([
      getWallet(address),
      getBanks(),
    ]);

    const bestByMint = new Map<string, Bank>();
    for (const b of banks) {
      const existing = bestByMint.get(b.mint);
      if (!existing || b.deposit_apy > existing.deposit_apy) {
        bestByMint.set(b.mint, b);
      }
    }

    const opportunities = wallet.tokens
      .filter((t: WalletToken) => t.usd_value >= min_usd_value)
      .map((t: WalletToken) => {
        const bank = bestByMint.get(t.address);
        if (!bank) return null;
        const annual = (t.usd_value * bank.deposit_apy) / 100;
        return {
          symbol: t.symbol,
          idle_usd: round(t.usd_value, 2),
          recommended_venue: bank.venue,
          recommended_bank: bank.bank_address,
          deposit_apy: bank.deposit_apy,
          projected_annual_yield_usd: round(annual, 2),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort(
        (a, b) =>
          b.projected_annual_yield_usd - a.projected_annual_yield_usd,
      );

    const totalIdleUsd = opportunities.reduce(
      (sum, o) => sum + o.idle_usd,
      0,
    );
    const totalYieldUsd = opportunities.reduce(
      (sum, o) => sum + o.projected_annual_yield_usd,
      0,
    );

    const headline =
      opportunities.length === 0
        ? `No idle capital detected above $${min_usd_value} in P0-eligible tokens. Wallet looks optimized (or holds unsupported assets).`
        : `This wallet is leaving roughly $${round(totalYieldUsd, 2).toLocaleString()}/yr on the table across ${opportunities.length} idle position${opportunities.length === 1 ? "" : "s"}. Top opportunity: deposit ${opportunities[0].symbol} ($${opportunities[0].idle_usd.toLocaleString()}) on ${opportunities[0].recommended_venue} at ${opportunities[0].deposit_apy.toFixed(2)}% APY for ~$${opportunities[0].projected_annual_yield_usd.toLocaleString()}/yr.`;

    return jsonResult({
      headline,
      total_idle_usd: round(totalIdleUsd, 2),
      total_projected_annual_yield_usd: round(totalYieldUsd, 2),
      opportunities,
    });
  },
);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function round(n: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
