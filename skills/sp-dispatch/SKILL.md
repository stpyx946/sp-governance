---
name: sp-dispatch
description: Quick task dispatch to a project via OMC agents with project context
argument-hint: "<project> [role] \"task description\""
triggers:
  - "派发任务"
  - "dispatch to"
  - "sp dispatch"
  - "派发给"
---

# SP Dispatch Skill (v8)

Streamlined task dispatch with project validation, role inference, and background execution.
Uses OMC agents (not SP-specific agents).

## Use When

- User wants to assign a task to a specific project
- User says "派发任务", "dispatch to", "派发给"

## Workflow

### 1. Parse Arguments

Format: `<project-name> [role] "task description"`

Role → OMC Agent mapping:
- "分析/analyze/design" → oh-my-claudecode:architect
- "实现/implement/fix/refactor" → oh-my-claudecode:executor
- "审查/review" → oh-my-claudecode:code-reviewer
- "测试/test" → oh-my-claudecode:test-engineer
- "文档/doc" → oh-my-claudecode:writer
- "安全/security" → oh-my-claudecode:security-reviewer
- "调试/debug" → oh-my-claudecode:debugger
- Default → oh-my-claudecode:executor

### 2. Validate Project

Read portfolio.json, fuzzy match project name.
If ambiguous, list candidates and ask user.

### 3. Build Context

```
[Project] <name> (<tech_stack>/<framework>)
[Path] <workspace>/<path>
[Group] <group>
[Level] <level>
[Task] <description>
```

### 4. Dispatch (Background)

```
Agent(subagent_type="oh-my-claudecode:<agent>",
      prompt="<context + task>",
      run_in_background=true)
```

For code implementation tasks, use `isolation: "worktree"`.

### 5. Monitor

Timeout thresholds: haiku 60s, sonnet 180s, opus 300s.
On timeout: TaskOutput(block=false) check → TaskStop if stuck → report to user.

## Examples

```
/sp-dispatch FamilyHub architect "分析认证模块安全性"
/sp-dispatch postiz-app executor "修复内存泄漏"
/sp-dispatch Cautia "更新 API 文档"
```
