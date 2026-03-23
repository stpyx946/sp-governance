---
name: sp-db-check
description: 数据库配置与 SQL 分析
argument-hint: "[project]"
triggers:
  - "数据库检查"
  - "db check"
---

# SP DB Check Skill

分析项目数据库配置和 SQL 映射。

## Use When
- 审查数据库表结构设计
- 检查 MyBatis/Prisma 映射一致性
- 数据模型变更影响分析

## Applicable Projects
- snapmaker-auth (MyBatis + MySQL)
- snapmaker-micro (MyBatis + MySQL)
- monitor (MySQL)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 分析数据模型
扫描 entity/model 类、mapper XML、schema 文件。

### 3. 输出报告
列出表结构、字段映射、潜在问题。

## Notes
- 执行角色: sp-architect (只读分析), sp-coder (修改)
- 权限约束: sp-architect 禁止 Edit/Write/Bash
- 涉及数据库变更需先获取用户环境配置
