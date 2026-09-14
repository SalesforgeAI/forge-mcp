import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

/** Build a workspace-scoped LinkedIn account URL. */
function accountsPath(workspaceId: string, accountId?: number) {
  const base = `/multichannel/workspaces/${enc(workspaceId)}/linkedin/accounts`;
  return accountId === undefined ? base : `${base}/${accountId}`;
}

/** Register LinkedIn connection and authentication challenge tools. */
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
    description: "Connect a new LinkedIn account. By default creates a draft sender profile. Set skipSenderProfile=true to connect standalone, then use create_sender_profile with linkedinAccountId. Use get_linkedin_account to check state and submit_linkedin_account_otp for challenges.",
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
    description: "Submit a one-time code for a pending LinkedIn authentication challenge after connecting.",
    inputSchema: { ...account, code: z.string().min(4).max(10) },
  }, ({ workspaceId, linkedinAccountId, code }) =>
    handleTool(() => client.mcPost(`${accountsPath(workspaceId, linkedinAccountId)}/otp`, { code })));

}
