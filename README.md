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

All tools hit P0's public APIs at `https://ai.0.xyz` — no auth, no keypair.

## Install — Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
or the equivalent on your OS:

```json
{
  "mcpServers": {
    "p0": {
      "command": "npx",
      "args": ["-y", "p0-mcp"]
    }
  }
}
```

Restart Claude Desktop. You should see the P0 tools available in the tools menu.

## Install — Cursor / Cline / others

Most MCP clients accept the same stdio config. See your client's docs for the
exact location of the MCP server registry.

## Try it

Once installed, ask your agent things like:

- _"What are the best Solana deposit yields on P0 right now?"_
- _"What's the cheapest stablecoin I can borrow on P0?"_
- _"Analyze this wallet: `<address>` — what would they earn if they deposited everything on P0?"_
- _"How much yearly yield is wallet `<address>` leaving on the table?"_

## Local development

```bash
pnpm install
pnpm dev   # runs against stdio — connect from a local MCP client
pnpm build # compile to dist/
```

## License

MIT
