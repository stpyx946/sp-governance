---
name: sp-status
description: Quick view of SP governance state - portfolio summary, groups, last diagnostic
triggers:
  - "sp状态"
  - "sp status"
  - "sp info"
  - "治理状态"
---

# SP Status Skill

Lightweight read-only status display.

## Use When

- User says "sp状态", "sp status"
- Quick check before dispatching tasks

## Workflow

### 1. Read State Files

- `portfolio.json` — project list and groups
- `sp-governance/.claude-plugin/plugin.json` — plugin version
- `.omc/bootstrap-state.json` — last diagnostic

### 2. Display

```
SP Governance Status
====================
Plugin:    sp-governance v<version>
Mode:      multi-project | single-project
Projects:  N registered
Groups:    N

GROUP BREAKDOWN:
  <group> (N): <project1>, <project2>, ...

DIAGNOSTICS:
  Last check:    <timestamp> (<Nh ago>)
  Drift status:  clean | drift-detected
  Health:        HEALTHY | ISSUES
```

### 3. Suggest Actions

- bootstrap-state.json missing → suggest sp-bootstrap
- Stale >24h → suggest sp-bootstrap
- Drift detected → suggest sp-scan

## Notes

- Pure read-only, no file writes, no agent dispatch
- PM may execute directly
