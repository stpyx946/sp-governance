---
name: sp-api-contract
description: 跨项目接口契约检查
argument-hint: "[interface]"
triggers:
  - "接口契约"
  - "api contract"
---

# SP API Contract Skill

检查跨项目接口契约一致性。

## Use When
- 验证前后端接口定义一致
- 微服务间接口变更影响评估
- API 版本兼容性检查

## Applicable Projects
- 跨项目接口 (cross-project)

## Workflow
### 1. 识别接口边界
确定涉及的项目对和接口定义。

### 2. 契约比对
- 请求/响应字段匹配
- 数据类型一致性
- 必选/可选字段对齐
- 版本兼容性

### 3. 输出报告
列出不一致项和兼容性风险。

## Notes
- 执行角色: sp-cross-architect (设计), sp-cross-reviewer (审查)
- 权限约束: 均禁止 Edit/Write/Bash，仅只读分析
