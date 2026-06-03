# SP Governance v9 → v10 Migration

v10 replaces the v9 three-layer adapter architecture with zero-coupling capability discovery. This guide walks through upgrading an existing v9 workspace.

## TL;DR

```bash
# In every workspace using SP Governance v9:
node ~/.claude/plugins/cache/sp-governance/sp-governance/10.0.0/scripts/migrate-v9-to-v10.mjs
```

Then with Claude Code:
1. `/sp-governance:sp-discovery-status` to confirm v10 detected
2. `/sp-governance:sp-trust-edit` if any plugins are in `pending`
3. `/sp-governance:sp-classify-projects` to add `governance_mode` to projects

## What changes

| v9 | v10 | Action |
|---|---|---|
| `scripts/adapters/` (hardcoded plugin names) | `scripts/lib/capability-discovery.mjs` (reads `installed_plugins.json`) | Removed; migration script doesn't depend on adapters |
| `.omc/state/integration.json` | `.omc/sp.json` + `.omc/cache/capabilities.json` | Migrated automatically |
| `agents/_archived/` (9 v7 stubs) | (deleted) | History preserved in git |
| Skills `sp-install-omc`, `sp-install-ecc`, `sp-integration-check` | `sp-discovery-status`, `sp-trust-edit`, `sp-classify-projects` | Replaced |
| Hooks called scripts directly | Three of four hooks go via `engine-router.mjs` | `hooks/hooks.json` updated; rebuild Claude plugin cache |
| Hardcoded role→agent mapping table | `route-guard` injects `<sp-capability-match>JSON</sp-capability-match>` | Main model parses and chooses |
| Fixed model recommendations (opus/sonnet/haiku per role) | `model` from upstream frontmatter, surfaced in JSON | Main model decides |

## Trust policy: ask by default

v10 default `trust.default_policy = "ask"`. After migration:
- Marketplaces v9 implicitly trusted (`omc`, `sp-governance`, `everything-claude-code`, `superpowers-marketplace`) are pre-set to `allow` in `.omc/sp.json::trust.marketplaces` (if installed).
- Newly discovered marketplaces (e.g. installed after migration) will land in `pending` until you decide.

To make v10 behave like v9 (auto-trust everything): set `trust.default_policy = "allow"`, or type `SP 信任默认 allow` in chat.

To deny by default (strictest): set `trust.default_policy = "deny"`, or type `SP 信任默认 deny`.

## governance_mode (new)

Add a `governance_mode` field to each project in `portfolio.json`:
- `auto` (default): full v10 governance.
- `readonly`: fork/learning projects — guards bypass sub-project entry.
- `off`: no SP intervention at all (including `destructive-guard`).
- `external`: placeholder for projects not actually present on disk.

Use `/sp-governance:sp-classify-projects` for guided batch editing.

## Dual-track rollback

If v10 misbehaves in a workspace:
1. In Claude Code, type: `切换 SP 引擎 v9`
2. This sets `.omc/sp.json::execution_engine = "v9"` via the Edit tool.
3. `engine-router.mjs` will dispatch to `sp-*-guard.v9.mjs` from the same v10.0.0 install.
4. To return to v10: `切换 SP 引擎 v10`.

**Known degradations on the v9 track in v10.0.0** (because `scripts/adapters/` is deleted):
- No ECC rule injection
- No OMC agent recommendation
- Core PM/Team-Lead allowlist + bootstrap state management still work normally

## Full rollback to v9.0.x

```bash
claude plugin uninstall sp-governance@sp-governance
claude plugin install sp-governance@sp-governance --version 9.0.3
```

Your `.omc/sp.json` is preserved on disk; if you reinstall v10 later it will pick up where you left off.

## Migration script details

The script `scripts/migrate-v9-to-v10.mjs` does:

1. Detects v9 residue (`.omc/state/integration.json`, `.sp/integration.json`); renames to `*.v9.bak.<ts>`.
2. Reads `~/.claude/plugins/installed_plugins.json`; enumerates marketplaces.
3. Generates `.omc/sp.json` (schema `sp-state-v1`):
   - `execution_engine: "v10"`
   - `trust.default_policy: "ask"`
   - `trust.marketplaces[<mkt>] = "allow"` for known v9 marketplaces, `"ask"` otherwise
   - One `decisions[]` entry noting auto-migration
4. Injects `<!-- SP:START -->` / `<!-- SP:END -->` block into workspace `CLAUDE.md` if missing.
5. Prints a JSON report and a human summary.

The script is **idempotent** — re-running on an already-migrated workspace is a no-op (reports `sp-json: { written: false, existed: true }`).

## Manual verification checklist

After running migration, verify:

- [ ] `.omc/sp.json` exists, `schema = "sp-state-v1"`, `execution_engine = "v10"`
- [ ] `.omc/cache/capabilities.json` generated after first `Agent` hook trigger
- [ ] `node skills/sp-discovery-status/check.mjs <workspace>` returns `allowed > 0` (if at least one mkt trusted)
- [ ] `node skills/sp-classify-projects/check.mjs <workspace>` lists every project
- [ ] Workspace `CLAUDE.md` contains `<!-- SP:START -->` block
- [ ] `scripts/adapters/` no longer exists
- [ ] `agents/_archived/` no longer exists
- [ ] `scripts/sp-bootstrap-guard.v9.mjs` (and pm-allowlist + route v9 siblings) remain on disk for dual-track rollback

## Known v9 → v10 behavior differences

- **Capability suggestions are JSON**, not prose. `route-guard` injects `<sp-capability-match>{"matches":[...]}</sp-capability-match>`. The main model parses and uses it; humans see raw JSON in transcripts.
- **No ECC rule preloading** — v9 injected ECC rules directories into Agent prompts. v10 leaves this to the ECC plugin itself (invoke ECC skills explicitly when needed).
- **No fixed model recommendation** — v9 mapped roles to fixed opus/sonnet/haiku. v10 surfaces `model` from frontmatter and lets the main model decide.
- **MCP tool allowlist is dynamic** — v9 hardcoded ~18 specific MCP tool names; v10 generates the allow list at hook invocation time from `trust.marketplaces`. Allow a new plugin → its MCP tools immediately become available. Deny → they're immediately rejected.
- **Path-prefix matching is stricter** — v10 distinguishes file entries (`portfolio.json`) from directory entries (`groups/`). `portfolio.json.bak` no longer accidentally passes the allowlist.
- **`>>` append redirect is blocked** — v10 explicitly catches Bash `>>` redirect, not just `>`. This closes a v9 escape route for arbitrary file writes via Bash.

## Frequently asked

**Q: Why is my plugin in `pending`?**
A: `default_policy: "ask"` and you haven't decided yet. Run `/sp-governance:sp-trust-edit` to allow/deny, or type `信任 marketplace <name>` directly.

**Q: Will my custom v9 adapters work?**
A: No — `scripts/adapters/` is deleted in v10. v9 hooks that referenced adapters via `try { await import('./adapters/...') } catch {}` degrade silently. If you have custom adapter logic, port it to a separate plugin that participates in capability discovery via standard frontmatter.

**Q: Can I run v9 indefinitely on the dual track?**
A: Yes for v10.0.x, but v11 will remove the `*.v9.mjs` siblings and `scripts/lib/integration.mjs`. Plan migration of any v9-dependent workflow before v11.

**Q: What if I edit `.omc/sp.json` manually and break it?**
A: `readSPState()` detects corruption and atomically renames the broken file to `sp.json.bak.<ts>`, then writes a fresh default. Your decisions are recoverable from the `.bak` file.

---

See [CHANGELOG.md](CHANGELOG.md) v10.0.0 section for the full Added/Changed/Removed list.
