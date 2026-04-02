---
name: sp-feishu-notify
description: 通过飞书 Webhook 发送通知
argument-hint: "--event <event> --data '<json>'"
triggers:
  - "飞书通知"
  - "webhook通知"
---

# SP Feishu Notify Skill

通过飞书群机器人 Webhook 发送结构化通知卡片。

## Use When
- 需要向飞书群发送通知
- Skill 执行完成后发送结果通知
- 登录态过期告警

## Workflow
### 1. 发送通知
```bash
node scripts/lib/feishu/notify.mjs --event <event> --data '{"key":"value"}'
```

### 2. 支持的事件类型
- skill_completed: Skill 执行完成
- skill_failed: Skill 执行失败
- feishu_doc_created: 文档创建成功
- login_expiring: 登录态即将过期
- login_expired: 登录态已过期
- health_check_result: 健康检查结果
- task_analysis_completed: 任务分析完成

## Notes
- 执行角色: sp-team-lead
- 不需要 Playwright，仅使用 HTTP fetch
- 需要在 config/feishu-config.json 中配置 webhook
