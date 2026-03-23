---
name: sp-release
description: SP governance plugin release workflow - version bump, pack, install, register
argument-hint: "[version]"
triggers:
  - "sp release"
  - "发布sp"
  - "发新版本"
  - "sp publish"
---

# SP Release Skill

Automated release workflow for the sp-governance plugin.

## Use When

- User says "sp release", "发布sp", "发新版本"
- After completing a governance iteration

## Workflow

### 1. Parse Version

If argument provided: use as-is or increment (patch/minor/major). Default: patch increment.
Read current version from `/workspace/snapmaker/sp-governance/.claude-plugin/plugin.json`.

### 2. Update Version

Update `.claude-plugin/plugin.json` version field.

### 3. Sync Project CLAUDE.md

Ensure `/workspace/snapmaker/CLAUDE.md` SP:START/END section matches source CLAUDE.md.

### 4. Package

```bash
cd /workspace/snapmaker/sp-governance
zip -r sp-governance-v<version>.zip . -x 'plans/*' '.git/*' 'node_modules/*' '.omc/*'
```

### 5. Install

```bash
rm -rf ~/.claude/plugins/sp-governance
cp -r /workspace/snapmaker/sp-governance ~/.claude/plugins/sp-governance

rm -rf ~/.claude/plugins/cache/sp-governance/sp-governance/*
cp -r /workspace/snapmaker/sp-governance ~/.claude/plugins/cache/sp-governance/sp-governance/<version>/

# Sync marketplace
cp CLAUDE.md scripts/ agents/ hooks/ governance/ templates/ .claude-plugin/ \
  ~/.claude/plugins/marketplaces/sp-governance/
```

### 6. Update Registry

Update `~/.claude/plugins/installed_plugins.json`:
- installPath → new version path
- version → new version
- lastUpdated → current ISO timestamp

### 7. Report

```
SP Governance v<version> released.
  <old> -> <new>
  Installed to: plugin dir + cache + marketplace + registry

Please run /reload-plugins
```

## Notes

- `plans/` excluded from packaging (iteration history only)
- PM may execute directly (governance management operation)
