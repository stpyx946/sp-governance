---
name: sp-prisma
description: Prisma ORM 操作
argument-hint: "[command]"
triggers:
  - "prisma migrate"
  - "prisma generate"
---

# SP Prisma Skill

执行 Prisma ORM 相关操作。

## Use When
- 生成 Prisma Client
- 执行数据库迁移
- 同步数据库 schema

## Applicable Projects
- snapmaker-hire (招聘平台)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取 hire 项目根目录。

### 2. 生成 Client
```bash
cd <project-root>
npx prisma generate
```

### 3. 迁移 (需用户确认)
```bash
npx prisma migrate dev --name <migration-name>
```

## Notes
- 执行角色: sp-coder (需用户提供 DB 配置)
- 权限约束: sp-coder 需 worktree 隔离
- 数据库迁移操作必须先获取用户的环境配置
