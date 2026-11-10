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
  const login = {
    password: z.string().min(1).optional().describe("LinkedIn password. Required unless cookies are sent."),
    cookies: z.array(z.object({
      name: z.string().min(1).describe("Cookie name, such as li_at"),
      value: z.string().min(1),
      domain: z.string().optional().describe("Cookie domain, such as .www.linkedin.com"),
    })).min(1).optional().describe("Cookies of a browser logged in to LinkedIn, instead of email and password. Must include li_at; li_a is used when present (Sales Navigator). No OTP is asked."),
    userAgent: z.string().min(1).optional().describe("User agent of the browser the cookies come from. Recommended with cookies."),
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
    description: "Connect a new LinkedIn account with email and password, or with the cookies of a browser logged in to LinkedIn (no OTP is asked, and the email is read from LinkedIn). By default creates a draft sender profile. Set skipSenderProfile=true to connect standalone, then use create_sender_profile or update_sender_profile with linkedinAccountId. Use get_linkedin_account to check state and submit_linkedin_account_otp for challenges. For an existing account use reconnect_linkedin_account.",
    inputSchema: z.object({
      workspaceId: z.string().min(1),
      email: z.string().email().optional().describe("LinkedIn login email. Required unless cookies are sent."),
      ...login,
      linkedinUrl: z.string().url().optional(),
      skipSenderProfile: z.boolean().optional(),
    }).refine(({ email, password, cookies }) => (cookies ? !email && !password : !!email && !!password), {
      message: "Send email and password, or cookies, not both",
    }),
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
    description: "Reconnect an existing LinkedIn account with its password, or with the cookies of a browser logged in to the same LinkedIn account, preserving its ID and sender-profile association. Also supports standalone accounts. If email is supplied it must match the existing account. Check state with get_linkedin_account and answer challenges with submit_linkedin_account_otp.",
    inputSchema: z.object({
      ...account,
      email: z.string().email().optional().describe("Must match the existing account's email. Not sent with cookies."),
      ...login,
    }).refine(({ email, password, cookies }) => (cookies ? !email && !password : !!password), {
      message: "Send a password, or cookies without email and password",
    }),
  }, ({ workspaceId, linkedinAccountId, ...body }) =>
    handleTool(() => client.mcPost(`${accountsPath(workspaceId, linkedinAccountId)}/reconnect`, body)));
}
