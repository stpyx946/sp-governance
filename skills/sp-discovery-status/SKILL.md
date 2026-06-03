---
name: sp-discovery-status
description: Report SP capability discovery status — installed plugins, trust verdicts, cache age, pending decisions. Use when user asks about SP state, what plugins SP sees, or troubleshoots capability matching.
---

# SP Discovery Status

This skill produces a read-only status report of:
- Number of installed plugins (from `~/.claude/plugins/installed_plugins.json`)
- Trust verdict breakdown (allowed / denied / pending)
- Capability cache age and source signature
- Any pending trust decisions awaiting user action

## Usage

Invoke the skill, then run:
```bash
node $CLAUDE_PLUGIN_ROOT/skills/sp-discovery-status/check.mjs <workspace-root>
```

Or from within a workspace:
```bash
node $CLAUDE_PLUGIN_ROOT/skills/sp-discovery-status/check.mjs
```

Output is JSON. Suggested interpretation:

- `allowed = 0` → no plugins trusted; SP capability matching does nothing
- `pending > 0` → user should run `/sp-governance:sp-trust-edit` to decide
- `cache_age_seconds > 86400` → cache stale; next hook will force rescan

## When to invoke

- User asks: "what plugins does SP see?"
- User asks: "why doesn't SP recommend an agent?"
- Capability matching seems wrong → check what's discoverable
- Before/after `sp-trust-edit` to verify decisions took effect
