---
name: sp-bootstrap
description: Full SP governance diagnostic - agents, governance files, project dirs, drift detection
triggers:
  - "sp检查"
  - "sp bootstrap"
  - "健康检查"
  - "sp diagnostic"
---

# SP Bootstrap Skill

Full governance diagnostic and state persistence.

## Use When

- User says "sp检查", "健康检查", "sp bootstrap"
- After plugin install/update
- When bootstrap-state.json stale >24h

## Workflow

### 1. Plugin Agent Verification

Check 9 agent definition files exist:
sp-architect, sp-coder, sp-reviewer, sp-tester, sp-team-lead, sp-group-lead, sp-doc-engineer, sp-cross-architect, sp-cross-reviewer

### 2. Governance Rule Files

Check 5 files exist:
role-permissions.md, workflow-rules.md, escalation-rules.md, violation-protocol.md, health-monitoring.md

### 3. Project Directory Verification

For each project in portfolio.json, verify directory exists and has build manifest.

### 4. .omc/ State Integrity

Check .omc/state/, bootstrap-state.json exist and are parseable.

### 5. Drift Detection

- New directories with project indicators not in portfolio.json
- Registered projects whose directories are missing

### 6. Update bootstrap-state.json

```json
{
  "last_full_diagnostic": "<ISO>",
  "status": "healthy|issues",
  "plugin_agents_count": 9,
  "governance_files_count": 5,
  "registered_projects": N,
  "detected_projects": N,
  "drift": { "unregistered": [], "missing": [] }
}
```

### 7. Report

```
SP Governance Health Report
===========================
Plugin:      v<version>
Agents:      9/9
Governance:  5/5
Projects:    N/N verified
Drift:       clean | N issues
Health:      HEALTHY | ISSUES

Issues: (list if any)
```

## Notes

- Read-only diagnostic except writing bootstrap-state.json
- PM may execute directly (governance management operation)
