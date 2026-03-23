---
name: sp-code-review
description: 代码审查
argument-hint: "[scope]"
triggers:
  - "代码审查"
  - "code review"
---

# SP Code Review Skill

执行代码审查，输出审查报告。

## Use When
- 代码合并前的质量审查
- 特定模块的深度审查

## Applicable Projects
- 所有已注册项目

## Workflow
### 1. 确认审查范围
确定审查的项目、文件或变更范围。

### 2. 执行审查
- 代码规范一致性
- 逻辑正确性
- 安全隐患
- 性能问题
- 可维护性

### 3. 输出报告
按严重程度分级列出问题和改进建议。

## Notes
- 执行角色: sp-reviewer
- 权限约束: sp-reviewer 禁止 Edit/Write/Bash，仅输出报告
