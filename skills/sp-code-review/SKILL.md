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

## ECC 增强

当 ECC 可用时，本 Skill 执行前会自动注入以下 ECC 领域知识:
- **security-review**: 安全审查检查清单（OWASP Top 10、输入验证、认证授权）

注入方式: 检查清单 (checklist) — 审查时逐项对照安全清单。
ECC 不可用时本 Skill 独立运行，功能不受影响。

## Notes
- 执行角色: sp-reviewer
- 权限约束: sp-reviewer 禁止 Edit/Write/Bash，仅输出报告
