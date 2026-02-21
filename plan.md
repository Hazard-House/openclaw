# Simplify Agent Onboarding Plan

## Current Decision Points (Interactive Flow)

The onboarding wizard currently presents **15+ decision points**. Here's every prompt a user faces, mapped against what we can default:

### Already Decided (by project scope)
| Decision | Current | Default To |
|----------|---------|------------|
| Model provider | 22 provider groups to choose from | **MiniMax** |
| Auth method | Sub-selection within provider (portal/api/cn/lightning) | **MiniMax Portal (Composio OAuth)** |
| Model | Full model catalog picker | **MiniMax M2.5** |
| Primary channel | 20+ channels to select | **Telegram** |
| Dashboard | TUI / Web UI / later | **OpenClaw dashboard (Web UI)** |

### Can Default (skip the prompt entirely)
| # | Decision | Current Prompt | Proposed Default | Rationale |
|---|----------|---------------|-----------------|-----------|
| 1 | **Onboarding mode** | QuickStart vs Manual | **QuickStart** (hardcode) | Manual mode exposes gateway port, bind, tailscale, etc. — not needed for single-agent |
| 2 | **Local vs Remote** | Local gateway vs Remote | **Local** | Single self-selected agent runs locally |
| 3 | **Workspace directory** | Text input (~/.openclaw/workspace) | **Use default** | No reason to customize for simplified flow |
| 4 | **Gateway port** | Text input (default 3777) | **3777** | QuickStart already defaults this |
| 5 | **Gateway bind** | 5 options (loopback/lan/tailnet/auto/custom) | **Loopback** | Safest default, Telegram doesn't need LAN |
| 6 | **Gateway auth mode** | Token vs Password | **Token** | Standard, auto-generated |
| 7 | **Gateway token** | Text input or auto-generate | **Auto-generate** | No user input needed |
| 8 | **Tailscale exposure** | Off/Serve/Funnel | **Off** | Not needed for Telegram + web dashboard |
| 9 | **DM policy** | Pairing/allowlist/open/disabled per channel | **Pairing** (default) | Safest default, QuickStart already skips this |
| 10 | **Skills setup** | Confirm + multi-select + node manager + API keys | **Skip** (configure later) | Overwhelming for first run; `openclaw configure --section skills` later |
| 11 | **Hooks setup** | Multi-select from eligible hooks | **Enable all eligible** or **Skip** | Not needed for initial "just get it running" |
| 12 | **Daemon runtime** | Node vs Bun selection | **Node** (QuickStart default) | QuickStart already defaults this |
| 13 | **Shell completion** | Prompt to install completions | **Skip** | Polish, not essential for onboarding |
| 14 | **Web search (Brave API)** | Info note about setup | **Skip note** | Can configure later |
| 15 | **Hatch method** | TUI / Web UI / later | **Open Web UI** | User specified dashboard |

### Must Still Prompt (cannot be defaulted)
| # | Decision | Why |
|---|----------|-----|
| 1 | **Risk acknowledgement** | Security requirement — user must confirm |
| 2 | **Telegram bot token** | User-specific secret, cannot be defaulted |
| 3 | **Composio OAuth flow** | User must authenticate (but flow is automated) |

## Implementation Approach

### Option A: New `--flow simple` mode
Add a new flow type `"simple"` alongside `"quickstart"` and `"advanced"`. This flow:
- Hardcodes all the defaults above
- Only prompts for: risk ack → Composio OAuth → Telegram bot token → done
- Auto-opens the dashboard at the end

### Option B: New dedicated command (`openclaw onboard --preset telegram-minimax`)
A preset system where combinations of defaults are bundled.

### Option C: Modify QuickStart to be even simpler (Recommended)
QuickStart already skips many prompts. Extend it to also skip:
- Auth provider selection (default MiniMax)
- Model selection (default M2.5)
- Channel selection (default Telegram, still ask for token)
- Skills (skip entirely)
- Hooks (skip or auto-enable)

This is the least invasive — QuickStart becomes the true "just works" path.

## Summary of What Gets Eliminated

**Before (QuickStart):** ~8 interactive prompts
**After (Simple):** ~3 interactive prompts (risk ack, Telegram token, OAuth)

**Before (Manual):** ~15+ interactive prompts
**After (Simple):** Same 3 prompts

The auth-choice-options.ts alone defines **22 provider groups** with **30+ individual auth methods**. The model picker can show **dozens of models**. The channel selector lists **20+ channels**. All of this goes away for the simplified flow.
