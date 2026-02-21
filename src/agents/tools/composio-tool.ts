import { Type } from "@sinclair/typebox";
import { getComposioClient } from "../../composio/client.js";
import {
  deleteConnection,
  executeAction,
  getConnectionStatus,
  initiateConnection,
  listConnectedAccounts,
} from "../../composio/connected-accounts.js";
import type { ComposioConfig } from "../../config/types.composio.js";
import { stringEnum } from "../schema/typebox.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam, readStringArrayParam } from "./common.js";

const COMPOSIO_ACTIONS = [
  "list_connections",
  "connect",
  "connect_multiple",
  "status",
  "disconnect",
  "execute",
] as const;

const ComposioToolSchema = Type.Object({
  action: stringEnum(COMPOSIO_ACTIONS),
  entityId: Type.Optional(
    Type.String({ description: "User entity ID. Defaults to the current session user." }),
  ),
  appName: Type.Optional(
    Type.String({
      description: "App/toolkit name (e.g. GMAIL, OUTLOOK, GOOGLECALENDAR, SLACK, GITHUB).",
    }),
  ),
  appNames: Type.Optional(
    Type.Array(Type.String(), {
      description: "Multiple app names for connect_multiple action.",
    }),
  ),
  connectedAccountId: Type.Optional(
    Type.String({ description: "Connected account ID for status/disconnect." }),
  ),
  redirectUri: Type.Optional(
    Type.String({ description: "OAuth redirect URI after authorization." }),
  ),
  actionName: Type.Optional(
    Type.String({
      description: "Composio action name to execute (e.g. GMAIL_SEND_EMAIL).",
    }),
  ),
  params: Type.Optional(
    Type.Object({}, { additionalProperties: true, description: "Parameters for execute action." }),
  ),
});

type ComposioToolOptions = {
  composioConfig?: ComposioConfig;
  /** Entity ID resolver: returns the entity ID for the current user context. */
  resolveEntityId?: () => string | undefined;
  agentSessionKey?: string;
};

export function createComposioTool(opts?: ComposioToolOptions): AnyAgentTool | null {
  const config = opts?.composioConfig;
  if (!config?.enabled && !process.env.COMPOSIO_API_KEY) {
    return null;
  }

  return {
    label: "Composio",
    name: "composio",
    description: `Manage external service connections and execute actions via Composio.

ACTIONS:
- list_connections: List all connected services for the current user
- connect: Initiate OAuth connection to a single service (returns auth URL for user)
- connect_multiple: Initiate connections to multiple services at once (returns auth URLs)
- status: Check status of a pending connection
- disconnect: Remove a connected service
- execute: Execute an action on a connected service

CONNECT FLOW:
1. Use connect or connect_multiple with the desired app name(s)
2. Send the returned auth URL(s) to the user
3. User clicks the link and authorizes in their browser
4. Connection becomes ACTIVE once authorized

SUPPORTED APPS (common):
- Email: GMAIL, OUTLOOK, OUTLOOK365
- Calendar: GOOGLECALENDAR, OUTLOOKCALENDAR
- Productivity: SLACK, NOTION, ASANA, JIRA, LINEAR, CLICKUP
- Developer: GITHUB, GITLAB
- Storage: GOOGLEDRIVE, DROPBOX, ONEDRIVE
- CRM: SALESFORCE, HUBSPOT

EXECUTE EXAMPLES:
- Gmail send: execute(actionName="GMAIL_SEND_EMAIL", params={to:"x@y.com", subject:"Hi", body:"Hello"})
- Gmail read: execute(actionName="GMAIL_FETCH_EMAILS", params={max_results:5})
- Calendar create: execute(actionName="GOOGLECALENDAR_CREATE_EVENT", params={summary:"Meeting", start_datetime:"...", end_datetime:"..."})
- Calendar list: execute(actionName="GOOGLECALENDAR_LIST_EVENTS", params={timeMin:"...", timeMax:"..."})
- Outlook send: execute(actionName="OUTLOOK_SEND_EMAIL", params={to:"x@y.com", subject:"Hi", body:"Hello"})
- Outlook read: execute(actionName="OUTLOOK_FETCH_EMAILS", params={max_results:5})`,
    parameters: ComposioToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      const client = getComposioClient(config);
      if (!client) {
        throw new Error(
          "Composio is not configured. Set COMPOSIO_API_KEY or configure composio.apiKey.",
        );
      }

      const entityId =
        readStringParam(params, "entityId") ?? opts?.resolveEntityId?.() ?? "default";

      switch (action) {
        case "list_connections": {
          const connections = await listConnectedAccounts(client, entityId);
          if (connections.length === 0) {
            return jsonResult({
              connections: [],
              message:
                "No services connected yet. Use the connect action to link services like Gmail, Outlook, Google Calendar, etc.",
            });
          }
          return jsonResult({ connections, entityId });
        }

        case "connect": {
          const appName = readStringParam(params, "appName", { required: true });
          const redirectUri = readStringParam(params, "redirectUri");
          const result = await initiateConnection(client, {
            entityId,
            appName,
            redirectUri: redirectUri ?? undefined,
          });
          return jsonResult({
            ...result,
            message: `Send the following link to the user to authorize ${appName}:`,
            authUrl: result.redirectUrl,
            appName,
          });
        }

        case "connect_multiple": {
          const appNames =
            readStringArrayParam(params, "appNames", { required: false }) ??
            (readStringParam(params, "appName")
              ? [readStringParam(params, "appName")!]
              : undefined);
          if (!appNames || appNames.length === 0) {
            throw new Error("appNames required for connect_multiple");
          }
          const maxAccounts = config?.maxAccountsPerUser ?? 20;
          if (appNames.length > maxAccounts) {
            throw new Error(`Cannot connect more than ${maxAccounts} services at once`);
          }
          const results = await Promise.all(
            appNames.map(async (name) => {
              try {
                const result = await initiateConnection(client, {
                  entityId,
                  appName: name,
                  redirectUri: readStringParam(params, "redirectUri") ?? undefined,
                });
                return {
                  appName: name.toUpperCase(),
                  ...result,
                  authUrl: result.redirectUrl,
                  error: null,
                };
              } catch (err) {
                return {
                  appName: name.toUpperCase(),
                  connectedAccountId: null,
                  redirectUrl: null,
                  authUrl: null,
                  error: String(err),
                };
              }
            }),
          );
          return jsonResult({
            connections: results,
            message:
              "Send the following auth links to the user. They should click each one to authorize the service:",
          });
        }

        case "status": {
          const connectedAccountId = readStringParam(params, "connectedAccountId", {
            required: true,
          });
          const status = await getConnectionStatus(client, connectedAccountId);
          return jsonResult(status);
        }

        case "disconnect": {
          const connectedAccountId = readStringParam(params, "connectedAccountId", {
            required: true,
          });
          await deleteConnection(client, connectedAccountId);
          return jsonResult({
            deleted: true,
            connectedAccountId,
            message: "Service disconnected successfully.",
          });
        }

        case "execute": {
          const actionName = readStringParam(params, "actionName", { required: true });
          const actionParams = (params.params as Record<string, unknown>) ?? {};
          const connectedAccountId = readStringParam(params, "connectedAccountId");
          const result = await executeAction(client, {
            entityId,
            actionName: actionName.toUpperCase(),
            params: actionParams,
            connectedAccountId: connectedAccountId ?? undefined,
          });
          return jsonResult(result);
        }

        default:
          throw new Error(`Unknown composio action: ${action}`);
      }
    },
  };
}
