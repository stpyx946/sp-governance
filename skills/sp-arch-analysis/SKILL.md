---
name: sp-arch-analysis
description: 项目架构分析
argument-hint: "[project|scope]"
triggers:
  - "架构分析"
  - "arch analysis"
---

# SP Arch Analysis Skill

执行项目架构分析，输出架构评估报告。

## Use When
- 评估项目整体架构
- 技术债务盘点
- 重构前的现状分析

## Applicable Projects
- 所有已注册项目

## Workflow
### 1. 确认分析范围
读取 portfolio.json 确定目标项目。

### 2. 分析维度
- 模块划分与依赖关系
- 分层架构合理性
- 技术栈选型评估
- 扩展性与可维护性

### 3. 输出报告
生成架构评估报告，包含问题和建议。

## ECC 增强

当 ECC 可用时，本 Skill 执行前会自动注入以下 ECC 领域知识:
- **backend-patterns**: 后端架构模式（分层架构、API 设计、数据访问模式）
- **hexagonal-architecture**: 六边形架构（端口-适配器模式、依赖反转）

注入方式: 参考 (reference) — 架构分析时参考成熟模式。
ECC 不可用时本 Skill 独立运行，功能不受影响。

## Notes
- 执行角色: sp-architect, sp-cross-architect (跨项目)
- 权限约束: sp-architect 禁止 Edit/Write/Bash，仅只读分析
