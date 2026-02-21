import { Composio } from "composio-core";
import type { ComposioConfig } from "../config/types.composio.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("composio");

let cachedClient: Composio | null = null;
let cachedApiKey: string | null = null;
let cachedBaseUrl: string | null = null;

function resolveApiKey(config?: ComposioConfig): string | undefined {
  return config?.apiKey?.trim() || process.env.COMPOSIO_API_KEY?.trim() || undefined;
}

function resolveBaseUrl(config?: ComposioConfig): string | undefined {
  return config?.baseUrl?.trim() || process.env.COMPOSIO_BASE_URL?.trim() || undefined;
}

export function getComposioClient(config?: ComposioConfig): Composio | null {
  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    log.warn("Composio API key not configured");
    return null;
  }
  const baseUrl = resolveBaseUrl(config) ?? undefined;

  if (cachedClient && cachedApiKey === apiKey && cachedBaseUrl === (baseUrl ?? null)) {
    return cachedClient;
  }

  const client = new Composio({ apiKey, baseUrl });
  cachedClient = client;
  cachedApiKey = apiKey;
  cachedBaseUrl = baseUrl ?? null;
  log.info("Composio client initialized");
  return client;
}

export function clearComposioClient(): void {
  cachedClient = null;
  cachedApiKey = null;
  cachedBaseUrl = null;
}
