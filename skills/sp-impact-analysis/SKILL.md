---
name: sp-impact-analysis
description: 变更影响分析
argument-hint: "[change-scope]"
triggers:
  - "影响分析"
  - "impact analysis"
---

# SP Impact Analysis Skill

分析代码变更对 portfolio 内其他项目的影响。

## Use When
- 评估变更的波及范围
- 共享模块修改前的风险评估
- 接口变更的下游影响

## Applicable Projects
- portfolio 全局

## Workflow
### 1. 确定变更范围
识别变更涉及的文件、模块、接口。

### 2. 影响追踪
- 直接依赖方
- 间接依赖链
- 共享数据模型影响
- API 消费者影响

### 3. 输出报告
按影响程度分级，列出受影响项目和建议措施。

## Notes
- 执行角色: sp-architect, sp-cross-architect
- 权限约束: 均禁止 Edit/Write/Bash，仅只读分析
