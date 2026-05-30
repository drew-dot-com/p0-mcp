# p0-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Project 0](https://www.0.xyz) Solana credit protocol. Lets any
MCP-compatible client (Claude Desktop, Cursor, Cline, Zed, Continue, Goose, …)
query live P0 banks, strategies, and wallet idle-capital opportunities.

> **v1 is read-only.** No keypair, no signing, no on-chain writes. Same
> safety posture as P0's public HTTP APIs.

## Why an MCP server (vs. the skill)?

The official P0 agent skill (`0dotxyz/p0-agents`) already teaches coding agents
how to hit these APIs, and it's portable — it's just markdown, so it works in
any harness that supports skills (Claude Code, OpenCode, Cursor, …), not only
Claude. So for a developer in a coding agent, the skill covers the read-only
ground.

An MCP server is complementary, and earns its keep in three places:

1. **Deterministic logic.** Risk math (health factor, liquidation, margin)
   lives in tested code here, returned as structured data — rather than being
   re-derived by the model from prose on every run. For anything financial,
   that determinism matters.
2. **Non-coding chat surfaces.** A skill needs an agent that can execute code
   or shell. An MCP server plugs straight into end-user chat clients (Claude
   Desktop, ChatGPT apps) where there is no code-execution step — the surface
   where a consumer-facing P0 experience would actually live.
3. **A path to interactive UI.** The MCP Apps/UI extension can render
   confirm-and-act cards inside the chat — the missing piece for an eventual
   in-chat trading flow (cf. Liquid's Co-Invest).

## Tools

| Tool                | Description                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `get_banks`         | List lending pools across P0 / Kamino / Drift. Filter by venue or symbol, sort by deposit or borrow APY.     |
| `get_strategies`    | Top pre-computed rate-arbitrage and looping strategies, sorted by projected APY.                             |
| `analyze_wallet`    | Take a Solana wallet address, return holdings + best deposit APY per token + projected annual yield in USD.  |
| `find_idle_capital` | Opinionated "you're leaving $X/yr on the table" breakdown — surfaces the single highest-impact action first. |
| `preview_position`  | Simulate a hypothetical deposit/borrow position — health factor, liquidation risk, net yield — from P0's published risk weights. Read-only, no signing. |

All tools hit P0's public APIs at `https://ai.0.xyz` — no auth, no keypair.

## Install

Clone and build:

```bash
git clone https://github.com/drew-dot-com/p0-mcp.git
cd p0-mcp
pnpm install   # or npm install
pnpm build     # compiles to dist/index.js
```

Then register it with your MCP client. For **Claude Desktop**, add to
`~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or the
equivalent on your OS, pointing at the built file:

```json
{
  "mcpServers": {
    "p0": {
      "command": "node",
      "args": ["/absolute/path/to/p0-mcp/dist/index.js"]
    }
  }
}
```

Fully quit and reopen Claude Desktop. The five P0 tools should appear in the
tools menu.

**Cursor / Cline / Zed / others** accept the same stdio config — see your
client's docs for where its MCP server registry lives.

> Once published to npm, install will simplify to a one-liner
> (`"command": "npx", "args": ["-y", "p0-mcp"]`). For now, build from source.

## Try it

Once installed, ask your agent things like:

- _"What are the best Solana deposit yields on P0 right now?"_
- _"What's the cheapest stablecoin I can borrow on P0?"_
- _"Analyze this wallet: `<address>` — what would they earn if they deposited everything on P0?"_
- _"How much yearly yield is wallet `<address>` leaving on the table?"_
- _"Preview depositing $1,000 of mSOL and borrowing $400 of USDC — is it safe?"_

## Local development

```bash
pnpm install
pnpm dev    # run from source over stdio
pnpm build  # compile to dist/
```

## License

MIT
