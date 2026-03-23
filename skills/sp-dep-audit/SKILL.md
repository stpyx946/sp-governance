---
name: sp-dep-audit
description: 依赖安全审计
argument-hint: "[project]"
triggers:
  - "依赖审计"
  - "dep audit"
---

# SP Dep Audit Skill

执行项目依赖安全审计。

## Use When
- 检查依赖是否有已知漏洞
- 定期安全审计

## Applicable Projects
- 所有已注册项目

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 执行审计
```bash
# Node.js 项目
npm audit

# Java 项目
mvn dependency:analyze

# Python 项目
pip-audit
```

### 3. 输出报告
列出漏洞等级、受影响包、修复建议。

## Notes
- 执行角色: sp-architect (分析), sp-reviewer (审查)
- 权限约束: sp-architect/sp-reviewer 禁止 Edit/Write/Bash
- 审计结果需人工评估风险等级
