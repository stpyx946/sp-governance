---
name: sp-deploy-check
description: 部署前综合检查
argument-hint: "[project]"
triggers:
  - "部署检查"
  - "deploy check"
---

# SP Deploy Check Skill

部署前执行综合检查清单。

## Use When
- 项目上线前的最终验证
- 确认构建、测试、配置均就绪

## Applicable Projects
- 所有已注册项目

## Workflow
### 1. 读取项目信息
从 portfolio.json 获取项目配置。

### 2. 检查清单
- 构建是否通过
- 测试是否全部通过
- lint/typecheck 是否通过
- 环境变量是否配置
- 依赖版本是否锁定

### 3. 输出报告
生成部署就绪度报告。

## Notes
- 执行角色: sp-architect (分析), sp-tester (执行验证)
- 权限约束: sp-architect 禁止 Edit/Write/Bash
