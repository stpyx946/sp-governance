---
name: sp-dispatch
description: Quick task dispatch to a project via the correct SP governance agent
argument-hint: "<project> [role] \"task description\""
triggers:
  - "派发任务"
  - "dispatch to"
  - "sp dispatch"
  - "派发给"
---

# SP Dispatch Skill

Streamlined task dispatch with project validation, role inference, and background execution.

## Use When

- User wants to assign a task to a specific project
- User says "派发任务", "dispatch to", "派发给"

## Workflow

### 1. Parse Arguments

Format: `<project-name> [role] "task description"`

Role inference (if omitted):
- "分析/analyze/design" → sp-architect
- "实现/implement/fix/refactor" → sp-coder
- "审查/review" → sp-reviewer
- "测试/test" → sp-tester
- "文档/doc" → sp-doc-engineer
- Default → sp-team-lead

### 2. Validate Project

Read portfolio.json, fuzzy match project name ("auth" → "snapmaker-auth").
If ambiguous, list candidates and ask user.

### 3. Build Context

```
[Project] <name>
[Path] /workspace/snapmaker/<path>
[Group] <group>
[Task] <description>
```

### 4. Dispatch (Background)

```
Agent(subagent_type="sp-governance:sp-<role>",
      prompt="<context + task>",
      run_in_background=true)
```

sp-coder must use `isolation: "worktree"`.

### 5. Monitor

Timeout thresholds: haiku 60s, sonnet 180s, opus 300s.
On timeout: TaskOutput(block=false) check → TaskStop if stuck → report to user.

## Examples

```
/sp-dispatch snapmaker-auth architect "分析认证模块安全性"
/sp-dispatch Luban coder "修复 3D 渲染器内存泄漏"
/sp-dispatch sm-nuxt3-website "更新首页 SEO"
```

## Notes

- Background dispatch mandatory per PM rules
- PM does not execute task, only dispatches and monitors
