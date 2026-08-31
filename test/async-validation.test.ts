import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeApiError, SalesforgeClient } from "../src/client.js";
import { registerEnrollmentTools } from "../src/tools/enrollments.js";
import { registerValidationTools, validationFiltersSchema } from "../src/tools/validations.js";

type RegisteredTool = {
  config: { description?: string; inputSchema?: z.ZodRawShape };
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;
};

type RecordingClient = Pick<SalesforgeClient, "mcGet" | "mcPost"> & {
  calls: Array<{ method: "GET" | "POST"; path: string; body?: unknown }>;
};

function createRecordingClient(responses: { get?: unknown; post?: unknown; getError?: Error; postError?: Error } = {}): RecordingClient {
  const calls: RecordingClient["calls"] = [];
  return {
    calls,
    async mcGet(path: string) {
      calls.push({ method: "GET", path });
      if (responses.getError) throw responses.getError;
      return responses.get;
    },
    async mcPost(path: string, body?: unknown) {
      calls.push({ method: "POST", path, body });
      if (responses.postError) throw responses.postError;
      return responses.post;
    },
  } as RecordingClient;
}

function registerTools(register: (server: McpServer, client: SalesforgeClient) => void, client: RecordingClient): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(name: string, config: RegisteredTool["config"], handler: RegisteredTool["handler"]) {
      tools.set(name, { config, handler });
      return {};
    },
  } as unknown as McpServer;

  register(server, client as unknown as SalesforgeClient);
  return tools;
}

function getTool(tools: Map<string, RegisteredTool>, name: string): RegisteredTool {
  const tool = tools.get(name);
  assert.ok(tool, `expected ${name} to be registered`);
  return tool;
}

function parseTextResult(result: { content: Array<{ type: "text"; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

const validationStatuses = [
  "safe",
  "invalid",
  "disabled",
  "disposable",
  "inbox_full",
  "catch_all",
  "role_account",
  "spamtrap",
  "unknown",
  "unvalidated",
  "linkedin_only",
] as const;

test("validation filters accept every supported filter and status", () => {
  const filters = {
    esps: ["gmail"],
    notInESPs: ["outlook"],
    validationStatuses: [...validationStatuses],
    tagIds: ["tag-1"],
    leadIds: ["lead-1"],
    customVars: ["priority"],
    notInCustomVars: ["excluded"],
    notInLeadIds: ["lead-2"],
    customVarIds: ["var-1"],
    notInCustomVarIds: ["var-2"],
    notInTagIds: ["tag-2"],
    searchQuery: "acme",
    selectionScope: "not_in_sequence",
    excludeContacted: true,
    numberOfContactsToAdd: 10,
    deleted: false,
    hasValidLinkedIn: true,
    withEmailOnly: true,
    hasEmail: true,
  };

  assert.deepEqual(validationFiltersSchema.parse(filters), filters);
});

test("validation filters reject empty objects and unknown keys", () => {
  assert.equal(validationFiltersSchema.safeParse({}).success, false);
  assert.equal(validationFiltersSchema.safeParse({ notInEsps: ["gmail"] }).success, false);
  assert.equal(validationFiltersSchema.safeParse({ hasEmail: true, typo: true }).success, false);
});

test("start validation rejects non-positive or non-integer limits", () => {
  const client = createRecordingClient();
  const startValidation = getTool(registerTools(registerValidationTools, client), "start_email_validation");
  const inputSchema = z.object(startValidation.config.inputSchema ?? {});

  for (const limit of [0, -1, 1.5]) {
    assert.equal(inputSchema.safeParse({ workspaceId: "workspace-1", filters: { hasEmail: true }, limit }).success, false);
  }
  assert.equal(validationFiltersSchema.safeParse({ numberOfContactsToAdd: 0 }).success, false);
  assert.equal(validationFiltersSchema.safeParse({ numberOfContactsToAdd: 1.5 }).success, false);
});

test("start validation advertises the Multichannel public API response contract", () => {
  const client = createRecordingClient();
  const startValidation = getTool(registerTools(registerValidationTools, client), "start_email_validation");
  const description = startValidation.config.description ?? "";

  assert.match(description, /candidate membership is resolved and persisted before the 201 response/i);
  assert.match(description, /selected is exact/i);
  assert.match(description, /skipped\.duplicate is exact/i);
  assert.match(description, /non-empty selection returns pending/i);
  assert.match(description, /empty selection returns failed with failureCode validation_scope_empty/i);
  assert.match(description, /strict .*deprecated/i);
  assert.match(description, /get_validation_results.*authoritative/i);
});

test("start validation preserves the API response and omits strict from its request body", async () => {
  const response = {
    validationJobID: "run-1",
    status: "pending",
    started: true,
    matched: 12,
    selected: 10,
    skipped: { duplicate: 2 },
  };
  const client = createRecordingClient({ post: response });
  const startValidation = getTool(registerTools(registerValidationTools, client), "start_email_validation");

  const result = await startValidation.handler({
    workspaceId: "workspace/1",
    filters: { hasEmail: true, numberOfContactsToAdd: 20 },
    limit: 10,
  });

  assert.deepEqual(client.calls, [
    {
      method: "POST",
      path: "/multichannel/workspaces/workspace%2F1/validations",
      body: { filters: { hasEmail: true, numberOfContactsToAdd: 20 }, limit: 10 },
    },
  ]);
  assert.deepEqual(parseTextResult(result), response);
});

test("validation result polling preserves optional terminal fields", async () => {
  const response = {
    summary: {
      gmail: {
        safe: 8,
        invalid: 0,
        disabled: 0,
        disposable: 0,
        inbox_full: 0,
        catch_all: 0,
        role_account: 0,
        spam_trap: 0,
        unknown: 0,
        unvalidated: 1,
      },
    },
    status: "partially_completed",
    finishedAt: "2026-08-31T10:00:00Z",
    failureCode: "validation_execution_failed",
    totals: {
      totalValidated: 9,
      totalSelected: 10,
      byStatus: {
        safe: 8,
        invalid: 0,
        disabled: 0,
        disposable: 0,
        inbox_full: 0,
        catch_all: 0,
        role_account: 0,
        spam_trap: 0,
        unknown: 0,
        unvalidated: 1,
      },
    },
  };
  const client = createRecordingClient({ get: response });
  const getValidationResults = getTool(registerTools(registerValidationTools, client), "get_validation_results");

  const result = await getValidationResults.handler({ workspaceId: "workspace/1", runId: "run/1" });

  assert.deepEqual(client.calls, [
    { method: "GET", path: "/multichannel/workspaces/workspace%2F1/validations/run%2F1/results" },
  ]);
  assert.deepEqual(parseTextResult(result), response);
});

test("enrollment tools preserve validation run and status filters", async () => {
  const response = { leadIds: ["lead-1", "lead-2"], skippedLeads: { "lead-3": "already_enrolled" } };
  const client = createRecordingClient({ post: response });
  const enrollContacts = getTool(registerTools(registerEnrollmentTools, client), "enroll_contacts");
  const filters = { validationRunId: "run-1", validationStatuses: ["safe", "catch_all"] };

  const result = await enrollContacts.handler({ workspaceId: "workspace-1", sequenceId: "sequence-1", filters, limit: 2 });

  assert.deepEqual(client.calls, [
    {
      method: "POST",
      path: "/multichannel/workspaces/workspace-1/sequences/sequence-1/enrollments",
      body: { filters, limit: 2 },
    },
  ]);
  assert.deepEqual(parseTextResult(result), response);
});

test("preflight enrollment preserves validation run and status filters", async () => {
  const response = {
    preflightId: "preflight-1",
    expiresAt: "2026-08-31T10:15:00Z",
    summary: {
      candidateCount: 2,
      decisionRequiredCount: 0,
      automaticEnrollmentCount: 2,
      alreadyInTargetCount: 0,
    },
    moveGroups: [],
    repliedDecision: { contactCount: 0 },
  };
  const client = createRecordingClient({ post: response });
  const preflightEnrollments = getTool(registerTools(registerEnrollmentTools, client), "preflight_enrollments");
  const filters = { validationRunId: "run-1", validationStatuses: ["safe", "catch_all"] };

  const result = await preflightEnrollments.handler({
    workspaceId: "workspace-1",
    sequenceId: "sequence-1",
    filters,
  });

  assert.deepEqual(client.calls, [
    {
      method: "POST",
      path: "/multichannel/workspaces/workspace-1/sequences/sequence-1/enrollments/preflight",
      body: { filters },
    },
  ]);
  assert.deepEqual(parseTextResult(result), response);
});

test("validation start and enrollment preflight pass documented upstream errors through shared error handling", async () => {
  const insufficientCredits = new SalesforgeApiError(402, '{"message":"insufficient credits"}');
  const validationRunNotCompleted = new SalesforgeApiError(
    409,
    '{"message":"validation_run_not_completed","data":{"runId":"run-1","status":"in_progress"}}',
  );
  const validationRunFailed = new SalesforgeApiError(
    409,
    '{"message":"validation_run_failed","data":{"runId":"run-2","status":"failed"}}',
  );
  const startClient = createRecordingClient({ postError: insufficientCredits });
  const incompleteRunClient = createRecordingClient({ postError: validationRunNotCompleted });
  const failedRunClient = createRecordingClient({ postError: validationRunFailed });
  const startValidation = getTool(registerTools(registerValidationTools, startClient), "start_email_validation");
  const incompleteRunPreflight = getTool(registerTools(registerEnrollmentTools, incompleteRunClient), "preflight_enrollments");
  const failedRunPreflight = getTool(registerTools(registerEnrollmentTools, failedRunClient), "preflight_enrollments");

  const startResult = await startValidation.handler({ workspaceId: "workspace-1", filters: { hasEmail: true } });
  const incompleteRunResult = await incompleteRunPreflight.handler({
    workspaceId: "workspace-1",
    sequenceId: "sequence-1",
    filters: { validationRunId: "run-1" },
  });
  const failedRunResult = await failedRunPreflight.handler({
    workspaceId: "workspace-1",
    sequenceId: "sequence-1",
    filters: { validationRunId: "run-2" },
  });

  assert.deepEqual(startResult, {
    content: [{ type: "text", text: 'Error: Salesforge API error 402: {"message":"insufficient credits"}' }],
    isError: true,
  });
  assert.deepEqual(incompleteRunResult, {
    content: [
      {
        type: "text",
        text: 'Error: Salesforge API error 409: {"message":"validation_run_not_completed","data":{"runId":"run-1","status":"in_progress"}}',
      },
    ],
    isError: true,
  });
  assert.deepEqual(failedRunResult, {
    content: [
      {
        type: "text",
        text: 'Error: Salesforge API error 409: {"message":"validation_run_failed","data":{"runId":"run-2","status":"failed"}}',
      },
    ],
    isError: true,
  });
});
