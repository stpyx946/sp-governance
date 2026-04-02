---
name: sp-feishu-project-board
description: 创建飞书项目空间（文档+多维表格+甘特图）
argument-hint: "[project-name]"
triggers:
  - "创建飞书项目"
  - "飞书项目初始化"
  - "feishu project board"
---

# SP Feishu Project Board Skill

在飞书中创建完整的项目空间，包括项目文档、多维表格看板和甘特图。

## Use When
- 启动新项目，需要在飞书创建项目管理空间
- 需要初始化项目看板和文档

## Workflow
### 1. 检查登录态
确保飞书 session 有效。

### 2. 创建项目空间
```bash
node scripts/feishu/feishu-init-project.mjs --user <user> --project "<project-name>"
```
或使用分步创建：
```bash
node scripts/feishu/feishu-create-project-board.mjs --user <user> --project "<project-name>"
```

### 3. 注册项目
```bash
node scripts/feishu/feishu-update-project.mjs --project "<project-name>" --url "<board-url>"
```

## Notes
- 执行角色: sp-team-lead
- 需要有效飞书登录态
- 模板路径: templates/feishu/project-board.md
