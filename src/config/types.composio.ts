export type ComposioConfig = {
  /** Enable Composio integration. Default: false. */
  enabled?: boolean;
  /** Composio Cloud API key. Can also be set via COMPOSIO_API_KEY env var. */
  apiKey?: string;
  /** Base URL for Composio API (for self-hosted). Default: Composio Cloud. */
  baseUrl?: string;
  /** Default toolkits to offer during onboarding (e.g. ["GMAIL", "OUTLOOK", "GOOGLECALENDAR"]). */
  defaultToolkits?: string[];
  /** Maximum connected accounts per user entity. Default: 20. */
  maxAccountsPerUser?: number;
};
