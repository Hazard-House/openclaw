import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type {
  AgentIdentityResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CostUsageSummary,
  GatewaySessionRow,
  PresenceEntry,
  SessionsListResult,
} from "../types.ts";

export type DashboardProps = {
  connected: boolean;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  channelsLoading: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  presenceLoading: boolean;
  presenceEntries: PresenceEntry[];
  usageCostSummary: CostUsageSummary | null;
  onRefresh: () => void;
  onNavigateToAgents: () => void;
  onNavigateToSessions: () => void;
};

function countActiveChannels(snapshot: ChannelsStatusSnapshot | null): number {
  if (!snapshot) {
    return 0;
  }
  let count = 0;
  for (const accounts of Object.values(snapshot.channelAccounts)) {
    if (accounts.some((acc) => acc.running === true)) {
      count++;
    }
  }
  return count;
}

function countTotalChannelAccounts(snapshot: ChannelsStatusSnapshot | null): number {
  if (!snapshot) {
    return 0;
  }
  let count = 0;
  for (const accounts of Object.values(snapshot.channelAccounts)) {
    count += accounts.length;
  }
  return count;
}

function renderStatCards(props: DashboardProps) {
  const agentCount = props.agentsList?.agents.length ?? 0;
  const sessionCount = props.sessionsResult?.count ?? 0;
  const instanceCount = props.presenceEntries.length;
  const activeChannels = countActiveChannels(props.channelsSnapshot);
  const totalAccounts = countTotalChannelAccounts(props.channelsSnapshot);

  return html`
    <div class="dash-stat-cards">
      <div class="dash-stat-card">
        <div class="dash-stat-label">Total Agents</div>
        <div class="dash-stat-value">${agentCount}</div>
        <div class="dash-stat-hint">Configured agents</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-label">Sessions</div>
        <div class="dash-stat-value">${sessionCount}</div>
        <div class="dash-stat-hint">Active gateway sessions</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-label">Instances</div>
        <div class="dash-stat-value">${instanceCount}</div>
        <div class="dash-stat-hint">Connected presences</div>
      </div>
      <div class="dash-stat-card dash-stat-card--accent">
        <div class="dash-stat-label">Active Channels</div>
        <div class="dash-stat-value">${activeChannels}</div>
        <div class="dash-stat-hint">${totalAccounts} account${totalAccounts !== 1 ? "s" : ""} configured</div>
      </div>
    </div>
  `;
}

function renderActivityChart(props: DashboardProps) {
  const daily = props.usageCostSummary?.daily ?? [];
  const last7 = daily.slice(-7);
  const maxTokens = Math.max(...last7.map((d) => d.totalTokens), 1);

  return html`
    <div class="dash-panel dash-panel--chart">
      <div class="dash-panel-header">
        <span class="dash-panel-title">Token Activity</span>
        <span class="dash-panel-sub">Last ${last7.length} day${last7.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="dash-bar-chart">
        ${
          last7.length > 0
            ? last7.map(
                (day) => html`
                  <div class="dash-bar-col">
                    <div
                      class="dash-bar"
                      style="height: ${Math.max(Math.round((day.totalTokens / maxTokens) * 100), 2)}%"
                      title="${day.date}: ${day.totalTokens.toLocaleString()} tokens · $${day.totalCost.toFixed(4)}"
                    ></div>
                    <div class="dash-bar-label">${day.date.slice(5)}</div>
                  </div>
                `,
              )
            : html`
                <div class="dash-empty">Visit the Usage tab to load token data.</div>
              `
        }
      </div>
    </div>
  `;
}

function renderCostOverview(props: DashboardProps) {
  const summary = props.usageCostSummary;
  const totalTokens = summary?.totals.totalTokens ?? 0;
  const totalCost = summary?.totals.totalCost ?? 0;

  const breakdown = [
    { label: "Input", tokens: summary?.totals.input ?? 0 },
    { label: "Output", tokens: summary?.totals.output ?? 0 },
    { label: "Cache Read", tokens: summary?.totals.cacheRead ?? 0 },
    { label: "Cache Write", tokens: summary?.totals.cacheWrite ?? 0 },
  ].filter((entry) => entry.tokens > 0);

  return html`
    <div class="dash-panel dash-panel--overview">
      <div class="dash-panel-header">
        <span class="dash-panel-title">Token Usage</span>
      </div>
      ${
        totalTokens > 0
          ? html`
              <div class="dash-big-number">${totalTokens.toLocaleString()}</div>
              <div class="dash-overview-rows">
                ${breakdown.map((entry) => {
                  const pct = totalTokens > 0 ? Math.round((entry.tokens / totalTokens) * 100) : 0;
                  return html`
                    <div class="dash-overview-row">
                      <span class="dash-overview-label">${entry.label}</span>
                      <div class="dash-overview-bar">
                        <div class="dash-overview-fill" style="width: ${pct}%"></div>
                      </div>
                      <span class="dash-overview-pct">${pct}%</span>
                    </div>
                  `;
                })}
              </div>
              <div class="dash-overview-footer">Total cost: $${totalCost.toFixed(4)}</div>
            `
          : html`
              <div class="dash-empty">Visit the Usage tab to load token data.</div>
            `
      }
    </div>
  `;
}

function sessionChannelLabel(row: GatewaySessionRow): string {
  if (row.surface) {
    return row.surface;
  }
  const parts = row.key.split(":");
  return parts[2] ?? parts[0] ?? "\u2014";
}

function sessionDisplayName(row: GatewaySessionRow): string {
  if (row.label) {
    return row.label;
  }
  if (row.displayName) {
    return row.displayName;
  }
  if (row.subject) {
    return row.subject;
  }
  const parts = row.key.split(":");
  return parts[parts.length - 1] ?? row.key;
}

function renderRecentSessions(props: DashboardProps) {
  const sessions = (props.sessionsResult?.sessions ?? []).slice(0, 8);

  return html`
    <div class="dash-panel dash-panel--sessions">
      <div class="dash-panel-header">
        <span class="dash-panel-title">Recent Sessions</span>
        <button class="dash-link-btn" @click=${props.onNavigateToSessions}>View all</button>
      </div>
      ${
        sessions.length > 0
          ? html`
              <table class="dash-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Channel</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessions.map(
                    (row) => html`
                      <tr>
                        <td class="dash-table-name">${sessionDisplayName(row)}</td>
                        <td class="dash-table-channel">${sessionChannelLabel(row)}</td>
                        <td class="dash-table-time">
                          ${row.updatedAt ? formatRelativeTimestamp(row.updatedAt) : "\u2014"}
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `
          : html`
              <div class="dash-empty">No sessions found.</div>
            `
      }
    </div>
  `;
}

function renderAgentList(props: DashboardProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;

  return html`
    <div class="dash-panel dash-panel--agents">
      <div class="dash-panel-header">
        <span class="dash-panel-title">Agents</span>
        <button class="dash-link-btn" @click=${props.onNavigateToAgents}>Manage</button>
      </div>
      <div class="dash-agent-list">
        ${
          agents.length > 0
            ? agents.map((agent) => {
                const identity = props.agentIdentityById[agent.id];
                const emoji = identity?.emoji ?? agent.identity?.emoji ?? null;
                const name = identity?.name ?? agent.identity?.name ?? agent.name ?? agent.id;
                const isDefault = agent.id === defaultId;
                return html`
                  <div class="dash-agent-card">
                    <span class="dash-agent-emoji">${emoji || name.slice(0, 1).toUpperCase()}</span>
                    <div class="dash-agent-info">
                      <div class="dash-agent-name">
                        ${name}
                        ${
                          isDefault
                            ? html`
                                <span class="dash-agent-badge">default</span>
                              `
                            : nothing
                        }
                      </div>
                      <div class="dash-agent-id">${agent.id}</div>
                    </div>
                    <span class="dash-agent-dot"></span>
                  </div>
                `;
              })
            : html`
                <div class="dash-empty">No agents configured.</div>
              `
        }
      </div>
    </div>
  `;
}

function renderChannelStatus(props: DashboardProps) {
  const snapshot = props.channelsSnapshot;
  if (!snapshot) {
    return html`
      <div class="dash-panel">
        <div class="dash-panel-header">
          <span class="dash-panel-title">Channel Status</span>
        </div>
        <div class="dash-empty">Channels not loaded yet.</div>
      </div>
    `;
  }

  const entries: Array<{ channel: string; label: string; running: number; total: number }> = [];
  for (const channelId of snapshot.channelOrder) {
    const accounts = snapshot.channelAccounts[channelId] ?? [];
    if (accounts.length === 0) {
      continue;
    }
    const running = accounts.filter((a) => a.running === true).length;
    const label = snapshot.channelLabels[channelId] ?? channelId;
    entries.push({ channel: channelId, label, running, total: accounts.length });
  }

  if (entries.length === 0) {
    return html`
      <div class="dash-panel">
        <div class="dash-panel-header">
          <span class="dash-panel-title">Channel Status</span>
        </div>
        <div class="dash-empty">No channels configured.</div>
      </div>
    `;
  }

  return html`
    <div class="dash-panel">
      <div class="dash-panel-header">
        <span class="dash-panel-title">Channel Status</span>
      </div>
      <div class="dash-channel-list">
        ${entries.map(
          (entry) => html`
            <div class="dash-channel-row">
              <span class="dash-channel-dot ${entry.running > 0 ? "dash-channel-dot--active" : ""}"></span>
              <span class="dash-channel-label">${entry.label}</span>
              <span class="dash-channel-count">${entry.running}/${entry.total}</span>
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

export function renderDashboard(props: DashboardProps) {
  const loading = props.agentsLoading || props.sessionsLoading || props.channelsLoading;

  return html`
    <div class="dashboard-view">
      <div class="dash-header">
        <div>
          <div class="dash-title">Dashboard</div>
          <div class="dash-subtitle">Live status across agents, sessions, channels, and usage.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${loading} @click=${props.onRefresh}>
          ${loading ? "Loading\u2026" : "Refresh"}
        </button>
      </div>
      ${renderStatCards(props)}
      <div class="dashboard-grid">
        <div class="dashboard-grid-left">
          ${renderActivityChart(props)}
          <div class="dashboard-grid-bottom">
            ${renderCostOverview(props)}
            ${renderRecentSessions(props)}
          </div>
        </div>
        <div class="dashboard-grid-right">
          ${renderAgentList(props)}
          ${renderChannelStatus(props)}
        </div>
      </div>
    </div>
  `;
}
