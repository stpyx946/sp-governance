---
name: sp-scan
description: Scan workspace for project drift - detect new, removed, or changed projects vs portfolio.json
triggers:
  - "扫描项目"
  - "scan projects"
  - "检测项目"
  - "project scan"
---

# SP Scan Skill

Workspace drift detection against portfolio.json.

## Use When

- User says "扫描项目", "scan projects"
- After cloning new repositories
- Suspecting portfolio.json is outdated

## Workflow

### 1. Read Portfolio

Read portfolio.json, extract registered projects and groups.

### 2. Scan Workspace

Scan direct subdirectories for project indicators:
.git, package.json, pom.xml, build.gradle, Cargo.toml, go.mod, pyproject.toml, requirements.txt, composer.json, pubspec.yaml, Makefile, CMakeLists.txt

### 3. Compare and Report

```
SP Workspace Scan Report
========================
Registered: N projects in M groups
Detected:   N subdirectories with project indicators

NEW (unregistered):
  - new-service/ (java_maven)

MISSING (directory not found):
  (none)

UNGROUPED:
  (none)
```

### 4. Optional Registration

If user confirms, for each new project:
1. Dispatch sp-architect (background) to analyze tech stack
2. Ask user which group to assign
3. Update portfolio.json
4. Report results

## Notes

- PM scans directories directly (lightweight read-only)
- Project analysis delegated to sp-architect agents
- Does not auto-modify portfolio.json without user confirmation
