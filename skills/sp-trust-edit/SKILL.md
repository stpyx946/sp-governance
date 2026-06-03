---
name: sp-trust-edit
description: Edit SP trust policy (.omc/sp.json) via guided dialog. Use when user wants to allow/deny/ask a marketplace or plugin, change default policy, or resolve pending decisions.
---

# SP Trust Edit

Guides the user through editing `.omc/sp.json::trust` without manual JSON wrangling.

## Usage

When invoked, perform these steps:

1. **Read current state** with `Read .omc/sp.json`.
   If file doesn't exist, create from default (use `lib/trust-policy.mjs::createDefaultState`).

2. **Run sp-discovery-status** to see what plugins SP currently sees + their verdicts.

3. **Identify pending decisions** (marketplaces with `default_policy='ask'` and no explicit entry).

4. **For each pending**, use `AskUserQuestion` with 3 options:
   - Allow this marketplace
   - Deny this marketplace
   - Skip (leave as ask)

5. **Apply user decisions** via `Edit` on `.omc/sp.json`:
   - Add to `trust.marketplaces[mkt] = "allow"|"deny"`
   - Append to `trust.decisions[]` with `{ ts, action, target, decided_by:"user" }`

6. **Optional**: ask user if they want to change `trust.default_policy` (currently shown).

7. **Final**: re-run sp-discovery-status to confirm new state.

## Direct edit alternative

Power users can edit `.omc/sp.json` directly with any editor. Schema:
```json
{
  "version": "1.0",
  "schema": "sp-state-v1",
  "execution_engine": "v10",
  "trust": {
    "default_policy": "allow|deny|ask",
    "marketplaces": { "<name>": "allow|deny|ask" },
    "plugins": { "<marketplace>/<plugin>": "allow|deny|ask" },
    "decisions": []
  },
  "config": {}
}
```

Decision priority: `plugins[mkt/plug]` > `marketplaces[mkt]` > `default_policy`.

## Runtime command alternative

Users can also type any of these in chat (handled by bootstrap-guard):
- `信任 marketplace <name>` / `取消信任 <name>` / `拉黑 <name>`
- `SP 信任默认 allow|deny|ask`
- `重置 SP 信任` (deletes sp.json, re-runs first-time setup)
- `切换 SP 引擎 v9|v10`
