---
name: sp-feishu-bitable
description: 飞书多维表格操作（创建/更新/查询）
argument-hint: "--action <action> [options]"
triggers:
  - "bitable"
  - "多维表格"
  - "飞书表格"
---

# SP Feishu Bitable Skill

管理飞书多维表格：创建、更新、查询、配置字段和数据。

## Use When
- 创建或管理飞书多维表格
- 批量更新表格数据
- 初始化项目看板表格

## Workflow
### 1. 创建多维表格
```bash
node scripts/feishu/feishu-create-bitable.mjs --user <user> --title "<title>" --data-file "<data.json>"
```

### 2. 管理表格（多种 action）
```bash
node scripts/feishu/bitable-manager.mjs --action <action> [options]
```
支持的 action: full-setup, create-bitable, add-fields, add-rows, rename-title 等。

### 3. 使用模板
bitable 模板位于 `config/bitable-templates/`，如 project-board.json、3d-model-site.json。

## Notes
- 执行角色: sp-team-lead
- 需要有效飞书登录态
- bitable-manager 支持 11 种操作
