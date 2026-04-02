---
name: sp-feishu-prd
description: 生成 PRD 产品需求文档并可选推送到飞书
argument-hint: "[project-name]"
triggers:
  - "PRD"
  - "产品需求"
  - "需求文档"
  - "写PRD"
---

# SP Feishu PRD Skill

基于模板生成 PRD 文档，可选推送到飞书云文档。

## Use When
- 需要为项目编写产品需求文档
- 需要将 PRD 推送到飞书共享

## Workflow
### 1. 生成 PRD
使用模板 `templates/feishu/prd.md` 结合项目信息生成 PRD 内容。

### 2. 本地保存
将生成的 PRD 保存到 `output/` 目录。

### 3. 推送飞书（可选）
```bash
node scripts/feishu/feishu-create-doc.mjs --user <user> --title "PRD: <项目名>" --content-file "./output/prd.md"
```

## Notes
- 执行角色: sp-doc-engineer
- 模板路径: templates/feishu/prd.md
- 推送飞书需要有效登录态
