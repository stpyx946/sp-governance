---
name: sp-status
description: SP v10 quick status - portfolio summary, trust policy, capability discovery stats, last refresh
triggers:
  - "sp状态"
  - "sp status"
  - "sp info"
  - "治理状态"
---

# SP Status Skill (v10)

Read-only status display covering portfolio, trust policy, and capability discovery.

## Use When

- User says "sp状态", "sp status", "治理状态"
- Quick check before dispatching tasks
- Verifying trust policy after an edit

## v10 Workflow

### 1. Read State Files

- `portfolio.json` — project list with `governance_mode` column (auto/readonly/off/external)
- `.claude-plugin/plugin.json` — SP plugin version
- `.omc/sp.json` — trust policy (schema `sp-state-v1`)
- `.omc/bootstrap-state.json` — 7-day staleness marker
- `.omc/cache/capabilities.json` — capability discovery cache (if exists)

### 2. Capability Discovery Stats

Invoke `/sp-governance:sp-discovery-status` (or run `node skills/sp-discovery-status/check.mjs <workspace>` directly) to get:
- discovered_plugins (count from `installed_plugins.json`)
- allowed / denied / pending (per trust policy)
- cache_age_seconds, cache_source_signature

### 3. Display

```
SP Governance Status (v10)
==========================
Plugin:           sp-governance v<version>
Execution engine: v10 | v9 (dual-track)
Mode:             with-plugins | sp-only
Projects:         N registered (M auto, K readonly, J off, I external)
Groups:           N

GROUP BREAKDOWN:
  <group> (N): <project1> [mode], <project2> [mode], ...

TRUST POLICY:
  Default:          allow | deny | ask
  Marketplaces:     N allowed, M denied, K pending
  Plugin overrides: N
  Decisions logged: N

CAPABILITY DISCOVERY:
  Installed:    N plugins
  Allowed:      M
  Pending:      K (run /sp-governance:sp-trust-edit to resolve)
  Cache age:    Ns

BOOTSTRAP:
  Last refresh: <timestamp> (<Nh ago>)
  Stale:        no | yes (auto-refresh next hook)
```

### 4. Suggest Actions

- `.omc/sp.json` missing → suggest `/sp-governance:sp-bootstrap`
- `pending > 0` → suggest `/sp-governance:sp-trust-edit`
- C-level projects with `governance_mode: "auto"` → suggest `/sp-governance:sp-classify-projects`
- Bootstrap stale → no action needed (auto-refresh handled by hook)
- `execution_engine: "v9"` → note dual-track mode; `切换 SP 引擎 v10` to switch back

## Notes

- Pure read-only — no file writes, no agent dispatch
- v9 `.omc/state/integration.json` is no longer read in v10 (migrate via `scripts/migrate-v9-to-v10.mjs` if it still exists)
- `governance_mode` column comes from `portfolio.json` project entries; default treated as `auto` when absent
