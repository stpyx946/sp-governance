---
name: sp-feishu-weekly
description: 生成周报/月报文档
argument-hint: "[period]"
triggers:
  - "周报"
  - "月报"
  - "写周报"
  - "weekly report"
---

# SP Feishu Weekly Report Skill

基于 git 历史和项目状态生成周报或月报。

## Use When
- 需要生成项目周报或月报
- 需要汇总本周工作进展

## Workflow
### 1. 收集数据
从 git log、任务列表等来源收集本周工作数据。

### 2. 生成报告
使用模板 `templates/feishu/weekly-report.md` 生成周报内容。

### 3. 推送飞书（可选）
```bash
node scripts/feishu/feishu-create-doc.mjs --user <user> --title "周报: <日期>" --content-file "./output/weekly.md"
```

## Notes
- 执行角色: sp-doc-engineer
- 模板路径: templates/feishu/weekly-report.md
