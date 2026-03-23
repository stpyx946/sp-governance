---
name: sp-dep-graph
description: 项目间依赖关系图
argument-hint: "[scope]"
triggers:
  - "依赖关系"
  - "dep graph"
---

# SP Dep Graph Skill

分析并展示 portfolio 内项目间依赖关系。

## Use When
- 理解项目间调用和依赖关系
- 变更影响范围评估
- 构建顺序规划

## Applicable Projects
- portfolio 全局

## Workflow
### 1. 读取 portfolio
从 portfolio.json 获取所有项目及其配置。

### 2. 分析依赖
- 服务间 API 调用关系
- 共享库依赖
- 数据库共享关系
- 配置依赖

### 3. 输出关系图
以文本或 Mermaid 格式输出依赖关系图。

## Notes
- 执行角色: sp-architect, sp-cross-architect
- 权限约束: 均禁止 Edit/Write/Bash，仅只读分析
