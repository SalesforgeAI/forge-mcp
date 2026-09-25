# Forge MCP Server

A remote MCP server that connects AI assistants to the full Salesforge product suite: Salesforge, Primeforge, Leadsforge, Infraforge, Warmforge, and Mailforge.

Built on the [Model Context Protocol](https://modelcontextprotocol.io), works with Claude Desktop, Claude Code, Cursor, Windsurf, and any MCP-compatible client.

## Supported Products

**Salesforge** (78 tools) - Account credits and subscription, workspaces, contacts, sequences and subsequences, lead progress, mailboxes, LinkedIn accounts, sender profiles, tags, enrollment preflight and confirmation, webhooks, email validation, do-not-contact lists

**Primeforge** (23 tools) - Workspaces, domains, mailboxes, DNS management, prewarmed mailboxes, bulk mailbox lookup

**Leadsforge** (12 tools) - Contact search, email/phone/LinkedIn enrichment, lookalike search

**Infraforge** (24 tools) - Workspaces, domains, mailboxes, DNS, domain availability, credits

**Warmforge** (15 tools) - Workspaces, mailboxes, warmup stats, placement tests, latest mailbox placement results

**Mailforge** (23 tools) - Workspaces, domains, mailboxes, DNS management, domain availability, auto-renewal, domain masking, forwarding

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
        "X-Salesforge-Key": "YOUR_SALESFORGE_API_KEY",
        "X-Primeforge-Key": "YOUR_PRIMEFORGE_API_KEY",
        "X-Leadsforge-Key": "YOUR_LEADSFORGE_API_KEY",
        "X-Infraforge-Key": "YOUR_INFRAFORGE_API_KEY",
        "X-Warmforge-Key": "YOUR_WARMFORGE_API_KEY",
        "X-Mailforge-Key": "YOUR_MAILFORGE_API_KEY"
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
  --header "X-Salesforge-Key: YOUR_SALESFORGE_API_KEY" \
  --header "X-Primeforge-Key: YOUR_PRIMEFORGE_API_KEY" \
  --header "X-Leadsforge-Key: YOUR_LEADSFORGE_API_KEY" \
  --header "X-Infraforge-Key: YOUR_INFRAFORGE_API_KEY" \
  --header "X-Warmforge-Key: YOUR_WARMFORGE_API_KEY" \
  --header "X-Mailforge-Key: YOUR_MAILFORGE_API_KEY"
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
| Mailforge | [app.mailforge.ai](https://app.mailforge.ai) > Settings > API |

## Authentication Headers

| Product | Header | Format |
|---|---|---|
| Salesforge | `X-Salesforge-Key` | `YOUR_API_KEY` |
| Primeforge | `X-Primeforge-Key` | `YOUR_API_KEY` |
| Leadsforge | `X-Leadsforge-Key` | `YOUR_API_KEY` |
| Infraforge | `X-Infraforge-Key` | `YOUR_API_KEY` |
| Warmforge | `X-Warmforge-Key` | `YOUR_API_KEY` |
| Mailforge | `X-Mailforge-Key` | `YOUR_API_KEY` |

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
- "List leads in sequence 31086 and show the actions and conditions executed for a lead"
- "Show the parent sequences and enrolled contacts for subsequence 31086"
- "Enroll these contacts into the sequence"
- "Show my Primeforge domains"
- "Search Leadsforge for CTOs at SaaS companies in New York"
- "Check my Infraforge credit balance"
- "Show warmup stats for my mailboxes"
- "Show which Warmforge mailboxes have 100% latest placement results"
- "List my Mailforge domains"
- "Check if example.com is available on Mailforge"

## Asynchronous Email Validation

Start validation with `start_email_validation`. Before returning HTTP 201, Multichannel resolves and persists candidate membership. `selected` and `skipped.duplicate` are exact, supported counts: a non-empty selection returns `status: pending`, while an empty selection returns `status: failed` with `failureCode: validation_scope_empty`. The legacy `strict` option is omitted and deprecated. Retain the returned `validationJobID` and poll `get_validation_results` with roughly ten-second backoff. Continue until the status is terminal: `completed`, `partially_completed`, or `failed`. Inspect the polling response before enrolling contacts; it is authoritative for validation outcomes, terminal counts are authoritative, and a failed run must not be automatically resubmitted.

For enrollment, use `preflight_enrollments` with the completed or partially completed `validationRunId`, inspect the preflight, then use `confirm_enrollment_preflight`. To restrict candidates, provide non-empty `validationStatuses`; omitted or empty statuses mean no status restriction and all run candidates, including unvalidated contacts, are considered. Durable async runs evaluate non-empty statuses against the requested run's persisted results, while legacy completed runs evaluate them against current Salesforge status. A partial run does not automatically select only its successful subset.

Local HTTP MCP testing still proxies the deployed Multichannel API.

## Rollout Dependency

Internal rollout order is binding: deploy the Multichannel async-validation contract before rolling out Forge MCP. Forge MCP must not reintroduce `strict: false` as a rollout workaround.

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
    ├── account.ts        # account credit balances and subscription
    ├── workspaces.ts     # workspace management
    ├── contacts.ts       # contact CRUD
    ├── mailboxes.ts      # mailbox and email operations
    ├── threads.ts        # primebox threads, labels, and LinkedIn replies
    ├── sequences.ts      # sequence lifecycle and lead progress
    ├── subsequences.ts   # subsequence triggers, parents, and members
    ├── nodes.ts          # sequence node management
    ├── branches.ts       # sequence branches
    ├── enrollments.ts    # contact enrollment
    ├── linkedin.ts       # LinkedIn connection and session management
    ├── tags.ts           # workspace tag discovery
    ├── sender-profiles.ts# sender profile management
    ├── validations.ts    # email validation
    ├── webhooks.ts       # webhook management
    ├── dnc.ts            # do-not-contact lists
    ├── custom-vars.ts    # custom variables
    ├── reference.ts      # action/condition type lookups
    ├── primeforge/       # domain, mailbox, workspace tools
    ├── leadsforge/       # search, enrichment, lookalike tools
    ├── infraforge/       # domain, mailbox, credit tools
    ├── warmforge/        # workspace, mailbox, placement test tools
    └── mailforge/        # workspace, domain, mailbox tools
```

## Self-Hosting

If you prefer to run your own instance:

```bash
npm install
npm run build
npm run start:http
```

The server listens on port 3000 by default. API keys are passed as headers per request, not as environment variables.

The HTTP endpoint uses stateless MCP POST requests. Standalone SSE streams are not offered: `GET /mcp` (and `HEAD`) returns `405 Method Not Allowed` before allocating an MCP server. Per-request servers and transports are closed after handling, on failures, and when clients disconnect before the response finishes.

### Diagnostic logging

Logging is enabled by default as JSON lines on **stderr**, suitable for container log collection. MCP stdio output remains reserved for protocol messages. HTTP requests, including `/health`, receive a generated `X-Request-Id` response header that correlates their request and upstream API logs.

| Environment variable | Default | Purpose |
|---|---|---|
| `LOG_LEVEL` | `info` | Minimum severity: `debug`, `info`, `warn`, or `error`. Debug adds MCP setup timings and upstream response-header timings. |
| `SLOW_REQUEST_MS` | `3000` | Emit one warning when an HTTP or upstream request remains pending this long. Does not cancel requests or change timeouts. |
| `RUNTIME_LOG_INTERVAL_MS` | `10000` | Interval for HTTP process metrics: active requests, event-loop delay/utilization, CPU, and memory. |

For more detail, run `LOG_LEVEL=debug npm run start:http`. Invalid settings fall back to their defaults. Keep `info` or `debug` enabled during timeout investigations so request starts and process metrics are retained.

- `http.request.started` without a matching `completed` or `aborted` event indicates an unfinished request or a process that stopped before logging completion. `http.request.slow` is emitted while the request is still pending, including during body parsing.
- `upstream.request.slow` identifies a pending product API call; its timing includes reading and parsing the response. The parent `requestId` links it to the HTTP request, and `upstreamRequestId` separates multiple API calls.
- `runtime.metrics` shows whether event-loop delay, CPU, memory, or request counts increased around a timeout. A blocked event loop also delays logging; its stall becomes visible after it resumes.
- If a timed-out health check has no corresponding request-start event, check proxy/load-balancer logs and container restarts too. Requests may not have reached Express, or the process may have been unable to run. Logging alone cannot establish the root cause.

The structured logs omit headers, bodies, query strings, upstream paths, and error messages/stacks to avoid capturing API keys and customer data. Errors include type, code, and HTTP status where available. Existing Node/Express native diagnostics may still appear separately. HTTP routes other than `/health` and `/mcp` are labeled `other`.

## License

MIT

## LinkedIn replies

Use `get_thread` to read the conversation, then call `reply_to_linkedin_thread` with `workspaceId`, `threadId`, the sending LinkedIn `accountId` from the thread's LinkedIn messages, and `message`. LinkedIn-only threads do not require a mailbox ID. The tool calls the existing Salesforge public API and returns the created LinkedIn message.

Optional `attachments` accept `filename`, `contentBase64`, and optional `contentType`. For an attachment-only reply, pass an empty `message` and at least one attachment. The API validates supported file types and size limits.

## Salesforge account and contact management

These tools require the public API additions in [multichannel-api #1068](https://github.com/SalesforgeAI/multichannel-api/pull/1068) and [salesforge-api #2795](https://github.com/SalesforgeAI/salesforge-api/pull/2795) (SF-9461). The matching API changes must be deployed before the tools can be used.

| Tools | Behavior |
| --- | --- |
| `create_sender_profile`, `bulk_create_sender_profiles` | Create profiles with optional existing mailbox IDs and a LinkedIn account ID. Bulk creation accepts 1–100 entries and reports each result independently. |
| `connect_linkedin_account` | Connect LinkedIn; set `skipSenderProfile: true` to skip automatic draft sender-profile creation. |
| `get_linkedin_account`, `submit_linkedin_account_otp` | Check connection state and answer authentication challenges. |
| `delete_contact`, `bulk_delete_contacts` | Delete one contact or up to 1,000 contacts. Bulk deletion ignores IDs outside the workspace. |
| `list_tags` | Discover tag IDs and names with pagination, name search, and optional case sensitivity. |

To attach a standalone LinkedIn account, use `create_sender_profile` with its `linkedinAccountId`. The account must belong to the workspace and must not already be attached to another sender profile.

The existing `delete_sender_profile` tool also deletes its attached LinkedIn account.

## Salesforge mailbox and LinkedIn lifecycle

These tools require [salesforge-api #2836](https://github.com/SalesforgeAI/salesforge-api/pull/2836) and [multichannel-api #1111](https://github.com/SalesforgeAI/multichannel-api/pull/1111) (SF-10349), on top of the SF-9461 API additions above. The matching API changes must be deployed before the tools can be used.

| Tools | Behavior |
| --- | --- |
| `disconnect_linkedin_account`, `reconnect_linkedin_account` | Manage the session while retaining account identity, history, limits, and the sender-profile association. |
| `delete_mailbox` | Remove the mailbox from Salesforge without deleting the email account at its provider. |
| `update_mailbox_connection_settings` | Update SMTP/IMAP settings even while connected. Supply complete `host`, `port`, `username`, and `password` settings for at least one protocol. Omitted protocols remain unchanged. OAuth mailboxes are unsupported. |
| `update_sender_profile` | Attach a standalone LinkedIn account using `updates.linkedinAccountId`. The profile must have no LinkedIn account, or already have that same account. Replacing a different account returns 409. Omitted/null `linkedinAccountId` leaves the association unchanged; omitted `mailboxIds` preserves mailboxes. |

There is no independent LinkedIn deletion tool or email disconnect tool. The existing `delete_sender_profile` tool also deletes its attached LinkedIn account.
