---
name: sp-docs-sync
description: Check git status, commit, and push documentation changes for SP-managed projects
argument-hint: "[project-name | --all]"
triggers:
  - "同步文档"
  - "docs sync"
  - "提交文档"
  - "push docs"
---

# SP Docs Sync Skill

Batch commit and push documentation changes across SP-managed projects.

## Use When

- User says "同步文档", "docs sync", "提交文档"
- After doc-engineer agents produce documentation
- After governance iterations modifying CLAUDE.md

## Workflow

### 1. Determine Scope

- `project-name`: single project
- `--all`: scan all registered projects
- No argument: ask user

### 2. Check Git Status

For each target project, check for doc-relevant changes:
*.md, CLAUDE.md, AGENTS.md, .omc/**, .claudeignore, portfolio.json

### 3. Display and Confirm

```
Documentation changes:

[project-name]
  M  CLAUDE.md
  A  docs/api.md

Commit message: "docs: update documentation"

Proceed? (yes / edit message / cancel)
```

### 4. Stage, Commit, Push

For each confirmed project:
```bash
cd /workspace/snapmaker/<project>
git add <filtered-doc-files>
git commit -m "<message>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push
```

### 5. Report

```
Docs Sync Complete:
  - project-a: 3 files committed and pushed
  - project-b: 2 files committed and pushed
  Total: 5 files across 2 projects
```

## Notes

- Only stages documentation files, never business code
- Push failures reported per-project without blocking others
- In multi-project mode, dispatches to sp-doc-engineer agents
