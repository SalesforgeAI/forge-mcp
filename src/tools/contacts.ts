import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

export function registerContactTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_contacts",
    {
      description: "List contacts in a workspace with optional filters (tags, validation status, pagination)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        limit: z.number().optional().describe("Max results per page (default 50)"),
        offset: z.number().optional().describe("Offset for pagination"),
        tagIds: z.string().optional().describe("Comma-separated tag IDs to filter by"),
        validationStatus: z.string().optional().describe("Filter by validation status: safe, invalid, catch_all, unknown, etc."),
      },
    },
    ({ workspaceId, ...opts }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/contacts`, buildQuery(opts))),
  );

  server.registerTool(
    "create_contact",
    {
      description: "Create a single contact in a workspace",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        firstName: z.string().describe("First name (required)"),
        lastName: z.string().optional().describe("Last name"),
        email: z.string().optional().describe("Email address"),
        company: z.string().optional().describe("Company name"),
        position: z.string().optional().describe("Job title/position"),
        linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
        tags: z.array(z.string()).optional().describe("Tag names to assign"),
        tagIds: z.array(z.string()).optional().describe("Tag IDs to assign"),
        customVars: z.record(z.string(), z.string()).optional().describe("Custom variables as key-value pairs"),
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/contacts`, body)),
  );

  server.registerTool(
    "bulk_create_contacts",
    {
      description: "Create up to 100 contacts in a workspace at once",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        contacts: z.array(
          z.object({
            firstName: z.string().describe("First name (required)"),
            lastName: z.string().optional(),
            email: z.string().optional(),
            company: z.string().optional(),
            position: z.string().optional(),
            linkedinUrl: z.string().optional(),
            tags: z.array(z.string()).optional(),
            tagIds: z.array(z.string()).optional(),
            customVars: z.record(z.string(), z.string()).optional(),
          }),
        ).describe("Array of contacts (1-100)"),
      },
    },
    ({ workspaceId, contacts }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/contacts/bulk`, { contacts })),
  );

  server.registerTool(
    "get_contact",
    {
      description: "Get a contact by ID",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        contactId: z.string().describe("Contact ID"),
      },
    },
    ({ workspaceId, contactId }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/contacts/${enc(contactId)}`)),
  );
}
