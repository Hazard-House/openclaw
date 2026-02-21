import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// --- onboard.auth.initiate ---

export const OnboardAuthInitiateParamsSchema = Type.Object(
  {
    /** Composio app to authenticate (e.g. "GMAIL", "GOOGLECALENDAR"). */
    appName: NonEmptyString,
    /** Unique entity identifier for the user (e.g. app install ID). */
    entityId: NonEmptyString,
    /** Custom URL scheme redirect for the iOS app (e.g. "openclaw://auth/callback"). */
    redirectUri: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const OnboardAuthInitiateResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    /** The Composio-hosted OAuth URL the app should open in ASWebAuthenticationSession. */
    redirectUrl: NonEmptyString,
    /** Composio connected-account ID to poll/verify later. */
    connectedAccountId: NonEmptyString,
  },
  { additionalProperties: false },
);

// --- onboard.auth.status ---

export const OnboardAuthStatusParamsSchema = Type.Object(
  {
    /** The connectedAccountId returned from onboard.auth.initiate. */
    connectedAccountId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const OnboardAuthStatusResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    connectedAccountId: NonEmptyString,
    status: Type.Union([
      Type.Literal("INITIATED"),
      Type.Literal("ACTIVE"),
      Type.Literal("EXPIRED"),
      Type.Literal("FAILED"),
    ]),
  },
  { additionalProperties: false },
);

// --- onboard.simple ---

export const OnboardSimpleParamsSchema = Type.Object(
  {
    /** The user's display name. */
    userName: NonEmptyString,
    /** The bot/agent's display name. */
    botName: NonEmptyString,
    /** One of the predefined recipe IDs. */
    recipeId: NonEmptyString,
    /** Composio entity ID (ties OAuth accounts to this user). */
    entityId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const OnboardSimpleResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    /** The created agent's ID (normalized from botName). */
    agentId: NonEmptyString,
    /** Workspace directory on the server. */
    workspace: NonEmptyString,
    /** The recipe that was applied. */
    recipeId: NonEmptyString,
    /** The model configured for this agent. */
    model: NonEmptyString,
  },
  { additionalProperties: false },
);

// --- onboard.recipes ---

export const OnboardRecipesParamsSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const OnboardRecipesResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    recipes: Type.Array(
      Type.Object(
        {
          id: NonEmptyString,
          label: NonEmptyString,
          description: NonEmptyString,
          emoji: NonEmptyString,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

// Inferred types for handler use.
export type OnboardAuthInitiateParams = {
  appName: string;
  entityId: string;
  redirectUri?: string;
};
export type OnboardAuthInitiateResult = {
  ok: true;
  redirectUrl: string;
  connectedAccountId: string;
};
export type OnboardAuthStatusParams = {
  connectedAccountId: string;
};
export type OnboardAuthStatusResult = {
  ok: true;
  connectedAccountId: string;
  status: "INITIATED" | "ACTIVE" | "EXPIRED" | "FAILED";
};
export type OnboardSimpleParams = {
  userName: string;
  botName: string;
  recipeId: string;
  entityId?: string;
};
export type OnboardSimpleResult = {
  ok: true;
  agentId: string;
  workspace: string;
  recipeId: string;
  model: string;
};
export type OnboardRecipesParams = Record<string, never>;
export type OnboardRecipesResult = {
  ok: true;
  recipes: Array<{
    id: string;
    label: string;
    description: string;
    emoji: string;
  }>;
};
