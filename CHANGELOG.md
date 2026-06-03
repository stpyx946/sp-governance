# Changelog

## [10.0.0] - 2026-06-03

### BREAKING CHANGES

- Removed `scripts/adapters/` directory entirely. Hardcoded upstream plugin names eliminated (9 files / 1208 lines).
- Removed `agents/_archived/` directory (9 v7 deprecated agent stubs).
- Removed skills `sp-install-omc`, `sp-install-ecc`, `sp-integration-check`.
- `.omc/state/integration.json` is no longer read or written. v9 → v10 migration script generates new `.omc/sp.json`.
- `route-guard` no longer injects ECC rules or OMC agent recommendations as prose. Output is now `<sp-capability-match>JSON</sp-capability-match>` parsed by the main model.
- Hook scripts invoked by direct path should switch to `engine-router.mjs <guard-name>` or rely on `sp-*.v9.mjs` directly.

### Added

- `scripts/engine-router.mjs` — dual-track v9/v10 dispatcher.
- `scripts/lib/frontmatter-parser.mjs` — zero-dep YAML subset parser with CRLF normalization (9 tests).
- `scripts/lib/plugin-index.mjs` — reads `installed_plugins.json` + sha256 source signature (6 tests).
- `scripts/lib/trust-policy.mjs` — `.omc/sp.json` read/write with decision priority (plugins > marketplaces > default) + atomic write + corruption recovery (6 tests).
- `scripts/lib/capability-discovery.mjs` — zero-coupling discovery: scan + inverted index + cache + matchCapabilities + getTrustedMCPPrefixes + getDiscoveryStats (6 tests).
- `scripts/lib/runtime-switch.mjs` — keyword detection with imperative-anchor false-positive guards (13 tests).
- `scripts/lib/bootstrap-state.mjs` — 7-day stale management (6 tests).
- `scripts/lib/integration-probe.mjs` — binary with-plugins / sp-only mode detection (3 tests).
- `scripts/lib/audit-log.mjs` — rotation-aware (5 MB × 3 history) audit log writer (3 tests).
- `scripts/lib/stopwords.mjs` — CN + EN stopwords with `buildStopwordSet` helper.
- `scripts/migrate-v9-to-v10.mjs` — idempotent v9 → v10 state migration.
- `skills/sp-discovery-status` — read-only discovery + trust state report.
- `skills/sp-trust-edit` — dialog-driven trust policy editing.
- `skills/sp-classify-projects` — half-automated `governance_mode` batch migration.
- `MIGRATION-V10.md` — v9 → v10 migration guide + dual-track rollback instructions.
- `portfolio.json` schema: `governance_mode` field (`auto` | `readonly` | `off` | `external`).
- `.omc/sp.json` schema `sp-state-v1`: trust policy + execution_engine + config segments.

### Changed

- `scripts/lib/portfolio.mjs` — added 30s LRU cache (`readPortfolio`), shared `getProjectForCwd`, `isProjectGovernanceSkipped` helpers (5 tests).
- `scripts/sp-bootstrap-guard.mjs` — rewritten as v10 (~125 lines, down from 327). Uses new lib modules + sub-agent bypass + parentToolUseId support.
- `scripts/sp-pm-allowlist-guard.mjs` — rewritten as v10 (~287 lines, down from 497). MCP allowlist derived dynamically from trust policy; path prefix matching tightened for file vs directory entries; `>>` append redirect explicitly blocked.
- `scripts/sp-route-guard.mjs` — rewritten as v10 (~126 lines, down from 193). Injects `<sp-capability-match>JSON</sp-capability-match>` via matchCapabilities.
- `scripts/sp-destructive-guard.mjs` — unchanged (single-tracked, no v9 sibling).
- `hooks/hooks.json` — three of four hooks now dispatched via `engine-router.mjs`.
- `skills/sp-bootstrap` and `skills/sp-status` — rewritten for v10 workflow (sp.json, capability discovery stats, governance_mode column, dual-track rollback).
- `README.md` / `CLAUDE.md` / `docs/global-claude-snippet.md` — rewritten for v10 zero-coupling model.
- `package.json` / `.claude-plugin/plugin.json` — bumped to `10.0.0` (Task 3.4).

### Preserved (dual-track)

- `scripts/sp-bootstrap-guard.v9.mjs`, `scripts/sp-pm-allowlist-guard.v9.mjs`, `scripts/sp-route-guard.v9.mjs` — frozen v9 implementations, reachable via `.omc/sp.json::execution_engine = "v9"` or input `切换 SP 引擎 v9`.
- `scripts/lib/integration.mjs` — kept for v9 hooks and `sp-install-claudemd.mjs` consumption. Will be removed in v11.

### Migration

- Run `node scripts/migrate-v9-to-v10.mjs` in each SP workspace to convert v9 state.
- See [MIGRATION-V10.md](MIGRATION-V10.md) for full instructions and rollback.

### Known degradations vs v9

- v9 hooks (when activated via `execution_engine: "v9"`) lose ECC rule injection and OMC agent recommendation because `scripts/adapters/` is deleted. Core PM/Team-Lead allowlist + bootstrap + state management still function normally.
- Capability suggestions are JSON (machine-readable), not prose. Main model parses `<sp-capability-match>` payload; humans see raw JSON in transcripts.
- No fixed model recommendation — v9 mapped roles to fixed opus/sonnet/haiku. v10 surfaces `model` from frontmatter and lets the main model decide.

### Test counts

57 unit tests across 9 test files in `scripts/lib/__tests__/`. All passing.

---

## [9.0.0-rc.1] - 2026-04-20

### Breaking Changes
- 废弃所有 `sp-governance:sp-*` agents，统一使用 OMC agents (oh-my-claudecode:*)
- 引入三层架构（SP 治理层 / OMC 执行层 / ECC 质量层）
- 集成状态结构变更（.sp/integration.json schema 重新定义）

### Added
- `scripts/adapters/` 适配层（omc-adapter, ecc-adapter, ecc-learning-bridge）
- `scripts/lib/integration.mjs` 集成状态核心库
- 5 个新 skill: sp-install-ecc, sp-install-omc, sp-integration-check, sp-learning-status, sp-upgrade-check
- `docs/three-layer-architecture.md` 三层架构文档
- MIGRATION.md 迁移指南

### Changed
- bootstrap-guard 支持 OMC/ECC 探测和运行模式判断
- route-guard 支持 ECC 规则上下文注入和 OMC agent 推荐
- ECC 最低兼容版本设为 1.8.0

### Fixed
- integration.mjs 输出结构与 schema.json 对齐
- techStack vs tech_stack 字段统一
- refreshIntegrationState async 误用修复
- writeIntegrationState 增加 workspaceRoot 校验

## [8.0.0] - 2026-04-14
- 轻量双角色模型（PM + Team-Lead）
- 完整卸载支持 (sp-uninstall skill)
- Bootstrap Guard 静默初始化

## [7.x] 及更早
- 完整 PM 角色模型
- 9 个 SP agents
- 违规检测 V1-V4
