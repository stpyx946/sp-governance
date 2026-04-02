---
name: sp-feishu-member-weekly
description: 汇总成员个人周报
argument-hint: "[member-name]"
triggers:
  - "成员周报"
  - "个人周报"
  - "周报汇总"
---

# SP Feishu Member Weekly Skill

收集和汇总团队成员的个人周报。

## Use When
- 需要汇总团队成员周报
- 需要生成个人工作总结

## Workflow
### 1. 收集成员数据
按成员维度收集 git commit、任务完成情况。

### 2. 生成汇总
使用模板 `templates/feishu/member-weekly.md` 生成成员周报。

### 3. 推送飞书（可选）
```bash
node scripts/feishu/feishu-create-doc.mjs --user <user> --title "成员周报: <member>" --content-file "./output/member-weekly.md"
```

## Notes
- 执行角色: sp-doc-engineer
- 模板路径: templates/feishu/member-weekly.md
