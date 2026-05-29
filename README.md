# p0-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Project 0](https://www.0.xyz) Solana credit protocol. Lets any
MCP-compatible client (Claude Desktop, Cursor, Cline, Zed, Continue, Goose, …)
query live P0 banks, strategies, and wallet idle-capital opportunities.

> **v1 is read-only.** No keypair, no signing, no on-chain writes. Same
> safety posture as P0's public HTTP APIs.

## Why

The official P0 agent skill (`0dotxyz/p0-agents`) is great inside Claude Code,
but it's Claude-Code-shaped. MCP is the standard way to expose the same
capabilities to every other agent client — so this server is the
"P0-everywhere" complement.

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
