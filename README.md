# Forge MCP Server

A remote MCP server that connects AI assistants to the full Salesforge product suite: Salesforge, Primeforge, Leadsforge, Infraforge, and Warmforge.

Built on the [Model Context Protocol](https://modelcontextprotocol.io), works with Claude Desktop, Claude Code, Cursor, Windsurf, and any MCP-compatible client.

## Supported Products

**Salesforge** (48 tools) - Workspaces, contacts, sequences, mailboxes, sender profiles, enrollments, webhooks, email validation, do-not-contact lists

**Primeforge** (22 tools) - Workspaces, domains, mailboxes, DNS management, prewarmed mailboxes

**Leadsforge** (12 tools) - Contact search, email/phone/LinkedIn enrichment, lookalike search

**Infraforge** (24 tools) - Workspaces, domains, mailboxes, DNS, domain availability, credits

**Warmforge** (12 tools) - Mailboxes, warmup stats, placement tests

Only provide API keys for the products you use. Tools for unconfigured products won't appear.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "salesforge": {
      "url": "https://mcp.salesforge.ai/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SALESFORGE_API_KEY",
        "X-Primeforge-Key": "YOUR_PRIMEFORGE_API_KEY",
        "X-Leadsforge-Key": "YOUR_LEADSFORGE_API_KEY",
        "X-Infraforge-Key": "YOUR_INFRAFORGE_API_KEY",
        "X-Warmforge-Key": "YOUR_WARMFORGE_API_KEY"
      }
    }
  }
}
```

Remove header lines for products you don't use. Restart Claude Desktop after saving.

### Claude Code

```bash
claude mcp add salesforge \
  --transport streamable-http \
  --url https://mcp.salesforge.ai/mcp \
  --header "Authorization: Bearer YOUR_SALESFORGE_API_KEY" \
  --header "X-Primeforge-Key: YOUR_PRIMEFORGE_API_KEY" \
  --header "X-Leadsforge-Key: YOUR_LEADSFORGE_API_KEY" \
  --header "X-Infraforge-Key: YOUR_INFRAFORGE_API_KEY" \
  --header "X-Warmforge-Key: YOUR_WARMFORGE_API_KEY"
```

### Cursor

Go to Settings > MCP and add a new server:

- **Name:** salesforge
- **Type:** streamable-http
- **URL:** https://mcp.salesforge.ai/mcp
- **Headers:** same as above

## Getting API Keys

| Product | Where to get it |
|---|---|
| Salesforge | [app.salesforge.ai](https://app.salesforge.ai) > Settings > API |
| Primeforge | [app.primeforge.ai](https://app.primeforge.ai) > Settings > API |
| Leadsforge | [app.leadsforge.ai](https://app.leadsforge.ai) > Settings > API |
| Infraforge | [app.infraforge.ai](https://app.infraforge.ai) > Settings > API |
| Warmforge | [app.warmforge.ai](https://app.warmforge.ai) > Settings > API |

## Authentication Headers

| Product | Header | Format |
|---|---|---|
| Salesforge | `Authorization` | `Bearer YOUR_API_KEY` |
| Primeforge | `X-Primeforge-Key` | `YOUR_API_KEY` |
| Leadsforge | `X-Leadsforge-Key` | `YOUR_API_KEY` |
| Infraforge | `X-Infraforge-Key` | `YOUR_API_KEY` |
| Warmforge | `X-Warmforge-Key` | `YOUR_API_KEY` |

## Multiple Accounts

If you manage multiple accounts (for example, different clients), add separate server entries:

```json
{
  "mcpServers": {
    "salesforge-client-a": {
      "url": "https://mcp.salesforge.ai/mcp",
      "headers": {
        "Authorization": "Bearer CLIENT_A_KEY"
      }
    },
    "salesforge-client-b": {
      "url": "https://mcp.salesforge.ai/mcp",
      "headers": {
        "Authorization": "Bearer CLIENT_B_KEY"
      }
    }
  }
}
```

Each entry gets its own name and API keys. Your AI assistant sees tools from both and you specify which client to work with in your prompts.

## Usage Examples

After setup, try asking your AI assistant:

- "List my Salesforge workspaces"
- "Show contacts tagged with 'enterprise' in workspace X"
- "Create a new sequence called 'Q2 Outreach'"
- "Enroll these contacts into the sequence"
- "Show my Primeforge domains"
- "Search Leadsforge for CTOs at SaaS companies in New York"
- "Check my Infraforge credit balance"
- "Show warmup stats for my mailboxes"

## Project Structure

```
src/
├── index.ts              # stdio entry point
├── http.ts               # HTTP/SSE transport entry point
├── server.ts             # MCP server setup, tool registration
├── api-client.ts         # HTTP client for upstream APIs
├── client.ts             # legacy client
├── helpers.ts            # shared utilities
└── tools/
    ├── identity.ts       # API key validation
    ├── workspaces.ts     # workspace management
    ├── contacts.ts       # contact CRUD
    ├── mailboxes.ts      # mailbox and email operations
    ├── sequences.ts      # sequence lifecycle
    ├── nodes.ts          # sequence node management
    ├── branches.ts       # sequence branches
    ├── enrollments.ts    # contact enrollment
    ├── sender-profiles.ts# sender profile management
    ├── validations.ts    # email validation
    ├── webhooks.ts       # webhook management
    ├── dnc.ts            # do-not-contact lists
    ├── custom-vars.ts    # custom variables
    ├── reference.ts      # action/condition type lookups
    ├── primeforge/       # domain, mailbox, workspace tools
    ├── leadsforge/       # search, enrichment, lookalike tools
    ├── infraforge/       # domain, mailbox, credit tools
    └── warmforge/        # mailbox, placement test tools
```

## Self-Hosting

If you prefer to run your own instance:

```bash
npm install
npm run build
npm run start:http
```

The server listens on port 3000 by default. API keys are passed as headers per request, not as environment variables.

## License

MIT
