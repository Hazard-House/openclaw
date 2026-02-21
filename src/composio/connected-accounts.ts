import type { Composio } from "composio-core";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { ComposioConnectedAccount, ComposioInitiateConnectionResult } from "./types.js";

const log = createSubsystemLogger("composio");

/** Safely coerce an unknown value to a string, falling back to the provided default. */
function toStr(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  return fallback;
}

export async function listConnectedAccounts(
  client: Composio,
  entityId: string,
): Promise<ComposioConnectedAccount[]> {
  try {
    const entity = client.getEntity(entityId);
    const connections = await entity.getConnections();
    return connections.map((conn) => {
      const rec = conn as Record<string, unknown>;
      return {
        id: toStr(rec.id),
        appName: toStr(rec.appName) || toStr(rec.app),
        status: toStr(rec.status, "ACTIVE") as ComposioConnectedAccount["status"],
        createdAt: toStr(rec.createdAt),
        updatedAt: toStr(rec.updatedAt),
      };
    });
  } catch (err) {
    log.error(`Failed to list connected accounts for entity ${entityId}: ${String(err)}`);
    throw err;
  }
}

export async function initiateConnection(
  client: Composio,
  params: {
    entityId: string;
    appName: string;
    redirectUri?: string;
  },
): Promise<ComposioInitiateConnectionResult> {
  try {
    const connectionRequest = await client.connectedAccounts.initiate({
      entityId: params.entityId,
      appName: params.appName.toUpperCase(),
      redirectUri: params.redirectUri,
    });
    return {
      connectedAccountId: connectionRequest.connectedAccountId,
      redirectUrl: connectionRequest.redirectUrl ?? "",
    };
  } catch (err) {
    log.error(
      `Failed to initiate connection for ${params.appName} (entity: ${params.entityId}): ${String(err)}`,
    );
    throw err;
  }
}

export async function getConnectionStatus(
  client: Composio,
  connectedAccountId: string,
): Promise<ComposioConnectedAccount> {
  try {
    const account = await client.connectedAccounts.get({
      connectedAccountId,
    });
    const raw = account as Record<string, unknown>;
    return {
      id: toStr(raw.id, connectedAccountId),
      appName: toStr(raw.appName) || toStr(raw.app),
      status: toStr(raw.status, "INITIATED") as ComposioConnectedAccount["status"],
      createdAt: toStr(raw.createdAt),
      updatedAt: toStr(raw.updatedAt),
    };
  } catch (err) {
    log.error(`Failed to get connection status for ${connectedAccountId}: ${String(err)}`);
    throw err;
  }
}

export async function deleteConnection(
  client: Composio,
  connectedAccountId: string,
): Promise<void> {
  try {
    await client.connectedAccounts.delete({ connectedAccountId });
  } catch (err) {
    log.error(`Failed to delete connection ${connectedAccountId}: ${String(err)}`);
    throw err;
  }
}

export async function executeAction(
  client: Composio,
  params: {
    entityId: string;
    actionName: string;
    params?: Record<string, unknown>;
    connectedAccountId?: string;
  },
): Promise<Record<string, unknown>> {
  try {
    const entity = client.getEntity(params.entityId);
    const result = await entity.execute({
      actionName: params.actionName,
      params: params.params,
      connectedAccountId: params.connectedAccountId,
    });
    return (result ?? {}) as Record<string, unknown>;
  } catch (err) {
    log.error(
      `Failed to execute action ${params.actionName} for entity ${params.entityId}: ${String(err)}`,
    );
    throw err;
  }
}
