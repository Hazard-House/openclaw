import fs from "node:fs/promises";
import path from "node:path";
import {
  resolveAgentDir,
  resolveAgentWorkspaceDir,
} from "../../agents/agent-scope.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  ensureAgentWorkspace,
} from "../../agents/workspace.js";
import {
  applyAgentConfig,
  findAgentEntryIndex,
  listAgentEntries,
} from "../../commands/agents.config.js";
import { applyMinimaxApiConfig } from "../../commands/onboard-auth.config-minimax.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { resolveSessionTranscriptsDirForAgent } from "../../config/sessions/paths.js";
import { getComposioClient } from "../../composio/client.js";
import {
  getConnectionStatus,
  initiateConnection,
} from "../../composio/connected-accounts.js";
import { getRecipe, listRecipes } from "../../onboarding/recipes.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../routing/session-key.js";
import { resolveUserPath } from "../../utils.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateOnboardAuthInitiateParams,
  validateOnboardAuthStatusParams,
  validateOnboardSimpleParams,
  validateOnboardRecipesParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/** The model reference applied to every simple-onboarded agent. */
const SIMPLE_ONBOARD_MODEL = "minimax/MiniMax-M2.5";

function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export const onboardSimpleHandlers: GatewayRequestHandlers = {
  // -----------------------------------------------------------------------
  // onboard.recipes — list available recipes (no auth needed, read-only)
  // -----------------------------------------------------------------------
  "onboard.recipes": ({ params, respond }) => {
    if (!validateOnboardRecipesParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid onboard.recipes params: ${formatValidationErrors(validateOnboardRecipesParams.errors)}`,
        ),
      );
      return;
    }
    const recipes = listRecipes().map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      emoji: r.emoji,
    }));
    respond(true, { ok: true, recipes }, undefined);
  },

  // -----------------------------------------------------------------------
  // onboard.auth.initiate — start Composio OAuth, return redirectUrl
  // -----------------------------------------------------------------------
  "onboard.auth.initiate": async ({ params, respond }) => {
    if (!validateOnboardAuthInitiateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid onboard.auth.initiate params: ${formatValidationErrors(validateOnboardAuthInitiateParams.errors)}`,
        ),
      );
      return;
    }

    const client = getComposioClient();
    if (!client) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          "Composio is not configured. Set composio.apiKey in openclaw.json or COMPOSIO_API_KEY env var.",
        ),
      );
      return;
    }

    try {
      const result = await initiateConnection(client, {
        entityId: String(params.entityId).trim(),
        appName: String(params.appName).trim(),
        redirectUri: typeof params.redirectUri === "string" ? params.redirectUri.trim() : undefined,
      });

      respond(
        true,
        {
          ok: true,
          redirectUrl: result.redirectUrl,
          connectedAccountId: result.connectedAccountId,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Composio connection failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  },

  // -----------------------------------------------------------------------
  // onboard.auth.status — poll Composio connection status
  // -----------------------------------------------------------------------
  "onboard.auth.status": async ({ params, respond }) => {
    if (!validateOnboardAuthStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid onboard.auth.status params: ${formatValidationErrors(validateOnboardAuthStatusParams.errors)}`,
        ),
      );
      return;
    }

    const client = getComposioClient();
    if (!client) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "Composio is not configured."),
      );
      return;
    }

    try {
      const account = await getConnectionStatus(
        client,
        String(params.connectedAccountId).trim(),
      );

      respond(
        true,
        {
          ok: true,
          connectedAccountId: account.id,
          status: account.status,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Composio status check failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  },

  // -----------------------------------------------------------------------
  // onboard.simple — create agent with recipe, configure model, done
  // -----------------------------------------------------------------------
  "onboard.simple": async ({ params, respond }) => {
    if (!validateOnboardSimpleParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid onboard.simple params: ${formatValidationErrors(validateOnboardSimpleParams.errors)}`,
        ),
      );
      return;
    }

    const botName = sanitizeLine(String(params.botName));
    const userName = sanitizeLine(String(params.userName));
    const recipeId = String(params.recipeId).trim();
    const entityId = typeof params.entityId === "string" ? params.entityId.trim() : undefined;

    // Validate recipe.
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unknown recipe: "${recipeId}"`),
      );
      return;
    }

    // Normalize agent ID from bot name.
    const agentId = normalizeAgentId(botName);
    if (agentId === DEFAULT_AGENT_ID) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `"${DEFAULT_AGENT_ID}" is reserved`),
      );
      return;
    }

    const cfg = loadConfig();

    // Check if agent already exists.
    if (findAgentEntryIndex(listAgentEntries(cfg), agentId) >= 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `agent "${agentId}" already exists`),
      );
      return;
    }

    // Resolve workspace directory (use default workspace root + agent name).
    const defaultWorkspaceBase = cfg.agents?.defaults?.workspace ?? "~/.openclaw/workspace";
    const workspaceDir = resolveUserPath(path.join(defaultWorkspaceBase, agentId));

    // Build config: create agent entry.
    let nextConfig = applyAgentConfig(cfg, {
      agentId,
      name: botName,
      workspace: workspaceDir,
    });
    const agentDir = resolveAgentDir(nextConfig, agentId);
    nextConfig = applyAgentConfig(nextConfig, { agentId, agentDir });

    // Apply MiniMax M2.5 model config.
    nextConfig = applyMinimaxApiConfig(nextConfig);

    // Store Composio entity ID if provided.
    if (entityId) {
      nextConfig = {
        ...nextConfig,
        composio: {
          ...nextConfig.composio,
          enabled: true,
        },
      };
    }

    // Ensure workspace & transcript directories exist BEFORE writing config.
    await ensureAgentWorkspace({ dir: workspaceDir, ensureBootstrapFiles: false });
    await fs.mkdir(resolveSessionTranscriptsDirForAgent(agentId), { recursive: true });

    // Write config.
    await writeConfigFile(nextConfig);

    // Write workspace files from recipe.
    const writeFile = async (name: string, content: string) => {
      await fs.writeFile(path.join(workspaceDir, name), content, "utf-8");
    };

    // IDENTITY.md — bot name + recipe emoji.
    await writeFile(
      DEFAULT_IDENTITY_FILENAME,
      [
        `# ${botName}`,
        "",
        `- Name: ${botName}`,
        `- Emoji: ${recipe.emoji}`,
        `- Creature: AI assistant`,
        "",
      ].join("\n"),
    );

    // USER.md — user's name.
    await writeFile(
      DEFAULT_USER_FILENAME,
      [
        "# USER.md - Who You're Helping",
        "",
        `- Name: ${userName}`,
        "",
        "_Update this file as you learn more about your user._",
        "",
      ].join("\n"),
    );

    // SOUL.md — from recipe.
    await writeFile(DEFAULT_SOUL_FILENAME, recipe.soul);

    // AGENTS.md — from recipe.
    await writeFile(DEFAULT_AGENTS_FILENAME, recipe.agents);

    // TOOLS.md — from recipe (optional).
    if (recipe.tools) {
      await writeFile(DEFAULT_TOOLS_FILENAME, recipe.tools);
    }

    respond(
      true,
      {
        ok: true,
        agentId,
        workspace: workspaceDir,
        recipeId: recipe.id,
        model: SIMPLE_ONBOARD_MODEL,
      },
      undefined,
    );
  },
};
