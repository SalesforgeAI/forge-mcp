import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

/** Build a workspace-scoped LinkedIn account URL. */
function accountsPath(workspaceId: string, accountId?: number) {
  const base = `/multichannel/workspaces/${enc(workspaceId)}/linkedin/accounts`;
  return accountId === undefined ? base : `${base}/${accountId}`;
}

/** Register LinkedIn connection, challenge, and session lifecycle tools. */
export function registerLinkedinTools(server: McpServer, client: SalesforgeClient) {
  const account = {
    workspaceId: z.string().min(1),
    linkedinAccountId: z.number().int().positive().describe("LinkedIn account ID returned by connect"),
  };
  const credentials = {
    password: z.string().min(1),
    proxy: z.object({
      host: z.string().min(1).describe("Proxy hostname, optionally with a scheme such as socks5://"),
      port: z.number().int().positive(),
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  };
  server.registerTool("connect_linkedin_account", {
    description: "Connect a new LinkedIn account. By default creates a draft sender profile. Set skipSenderProfile=true to connect standalone, then use create_sender_profile or update_sender_profile with linkedinAccountId. Use get_linkedin_account to check state and submit_linkedin_account_otp for challenges. For an existing account use reconnect_linkedin_account.",
    inputSchema: {
      workspaceId: z.string().min(1),
      email: z.string().email(),
      ...credentials,
      linkedinUrl: z.string().url().optional(),
      skipSenderProfile: z.boolean().optional(),
    },
  }, ({ workspaceId, ...body }) => handleTool(() => client.mcPost(accountsPath(workspaceId), body)));

  server.registerTool("get_linkedin_account", {
    description: "Get a LinkedIn account's connection state, including pending authentication challenges.",
    inputSchema: account,
  }, ({ workspaceId, linkedinAccountId }) =>
    handleTool(() => client.mcGet(accountsPath(workspaceId, linkedinAccountId))));

  server.registerTool("submit_linkedin_account_otp", {
    description: "Submit a one-time code for a pending LinkedIn authentication challenge after connecting or reconnecting.",
    inputSchema: { ...account, code: z.string().min(4).max(10) },
  }, ({ workspaceId, linkedinAccountId, code }) =>
    handleTool(() => client.mcPost(`${accountsPath(workspaceId, linkedinAccountId)}/otp`, { code })));

  server.registerTool("disconnect_linkedin_account", {
    description: "Disconnect a LinkedIn session while preserving the account, sender-profile association, limits, and history. The account is not deleted or detached from its sender profile.",
    inputSchema: account,
  }, ({ workspaceId, linkedinAccountId }) =>
    handleTool(() => client.mcPost(`${accountsPath(workspaceId, linkedinAccountId)}/disconnect`)));

  server.registerTool("reconnect_linkedin_account", {
    description: "Reconnect an existing LinkedIn account with credentials, preserving its ID and sender-profile association. Also supports standalone accounts. If email is supplied it must match the existing account. Check state with get_linkedin_account and answer challenges with submit_linkedin_account_otp.",
    inputSchema: { ...account, email: z.string().email().optional(), ...credentials },
  }, ({ workspaceId, linkedinAccountId, ...body }) =>
    handleTool(() => client.mcPost(`${accountsPath(workspaceId, linkedinAccountId)}/reconnect`, body)));
}
