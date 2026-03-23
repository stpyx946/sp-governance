---
name: sp-jest
description: Jest 单元测试
argument-hint: "[file|pattern]"
triggers:
  - "jest测试"
  - "admin测试"
---

# SP Jest Skill

执行 Jest 单元测试。

## Use When
- 运行 admin 项目单元测试
- 验证后台管理系统代码变更

## Applicable Projects
- snapmaker-admin (后台管理)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取 admin 项目根目录。

### 2. 执行测试
```bash
cd <project-root>
pnpm run test
```

## Notes
- 执行角色: sp-tester
- 权限约束: sp-tester 拥有全权限
- 使用 pnpm 作为包管理器
