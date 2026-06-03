---
name: sp-classify-projects
description: Half-automated batch migration of portfolio.json to add governance_mode field per project. Use when user wants to mark read-only forks/learning material as governance_mode=readonly to bypass SP hooks.
---

# SP Classify Projects

Adds `governance_mode` field to each project in `portfolio.json`.
Valid values: `auto` (default), `readonly`, `off`, `external`.

## Usage

1. **Run the check script** to see projects + heuristic suggestions:
   ```bash
   node $CLAUDE_PLUGIN_ROOT/skills/sp-classify-projects/check.mjs <workspace-root>
   ```
   Output: JSON listing each project with `current_mode` and `suggested_mode`.

2. **Heuristics** the script applies:
   - Description contains "fork"/"翻译"/"中文版"/"electron book"/"教程" → suggest `readonly`
   - Level `C` AND framework in [`docs`, `ebooks`, `research`, `templates`] → suggest `readonly`
   - All others → suggest `auto`

3. **For each project where current_mode != suggested_mode**, use `AskUserQuestion`:
   - Accept suggestion
   - Keep current
   - Set to off / external manually

4. **Apply decisions** via `Edit` on `portfolio.json` — set each project's `governance_mode` field.

5. **Confirm** by re-running the check script.

## When to invoke

- After v10 migration (governance_mode field is new)
- When user adds new fork/learning project to portfolio.json
- When user wants to silence SP hooks on a specific project subtree
