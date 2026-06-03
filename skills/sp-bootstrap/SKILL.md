---
name: sp-bootstrap
description: SP v10 bootstrap workflow - guides first-run trust policy setup, discovers installed plugins, and refreshes 7-day stale state
triggers:
  - "sp检查"
  - "sp bootstrap"
  - "健康检查"
  - "sp diagnostic"
  - "sp 引导"
---

# SP Bootstrap Skill (v10)

Guides workspace through SP v10 governance setup and the 7-day staleness refresh cycle.

## Use When

- First-time enabling SP in a workspace (no `portfolio.json` yet)
- After plugin install/update
- When `.omc/bootstrap-state.json` is stale (>7 days)
- User says "sp检查", "sp bootstrap", "健康检查"

## v10 Workflow

### 1. Workspace Detection

Check the current workspace for:
- `portfolio.json` — project registry (created on first enable)
- `.omc/sp.json` — trust policy state (schema `sp-state-v1`, created on first run)
- `.omc/bootstrap-state.json` — 7-day staleness marker
- `.sp-disabled` — opt-out flag (if present, do nothing)

### 2. First-Run Setup

If `portfolio.json` is missing, use `AskUserQuestion` to ask whether to enable SP. If yes:

1. Scan workspace subdirectories for project indicators (`.git`, `package.json`, `pom.xml`, `Cargo.toml`, `go.mod`, etc.)
2. Identify tech stack per project (java/nodejs/python/go/rust/etc.)
3. Generate `portfolio.json` with `governance_mode: "auto"` default per project
4. Inject `<!-- SP:START --> ... <!-- SP:END -->` block into workspace `CLAUDE.md` (run `node scripts/sp-install-claudemd.mjs` or manually copy from `docs/global-claude-snippet.md`)
5. Create `.omc/sp.json` from default state — `execution_engine: "v10"`, `trust.default_policy: "ask"`, empty marketplaces

### 3. Trust Policy Initialization

After `sp.json` exists, `default_policy: "ask"` means every newly discovered marketplace lands in **pending**. Direct the user to:

- Run `/sp-governance:sp-discovery-status` to see what was discovered and what's pending
- Run `/sp-governance:sp-trust-edit` to decide allow/deny per marketplace

Users can change `default_policy` to `"allow"` (mimic v9 auto-trust) or `"deny"` (strictest) via the `SP 信任默认 allow|deny|ask` runtime command, handled by `bootstrap-guard` keyword detection.

### 4. Bootstrap State Refresh (7-day cycle)

If `.omc/bootstrap-state.json::last_full_diagnostic` is older than 7 days, `bootstrap-guard` automatically refreshes the timestamp and emits a one-line reminder. No action needed from user.

### 5. Project Classification (optional follow-up)

After bootstrap, suggest running `/sp-governance:sp-classify-projects` to add `governance_mode` to entries — many fork/learning projects should be `readonly` (skips Team-Lead role + hook scrutiny).

## Notes

- v10 no longer uses `.omc/state/integration.json` (v9 tri-state). Migration is automatic on first v10 run; v9 files are backed up to `*.v9.bak.<ts>`.
- The 9 v7 `sp-*` agents are deprecated and deleted in v10. Use OMC's `oh-my-claudecode:*` agents (recommendations injected automatically by `route-guard` via `<sp-capability-match>` JSON).
- Sub-projects (CWD inside a registered project) bypass this skill — first-run setup only applies at the workspace root.
- Dual-track rollback: if v10 misbehaves, type `切换 SP 引擎 v9` to revert; `engine-router` will dispatch to `sp-*-guard.v9.mjs`.
