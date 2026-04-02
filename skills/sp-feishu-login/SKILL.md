---
name: sp-feishu-login
description: 飞书会话登录，保存 Playwright session
argument-hint: "[username]"
triggers:
  - "飞书登录"
  - "feishu login"
---

# SP Feishu Login Skill

启动飞书登录流程，保存浏览器 session 供后续自动化使用。

## Use When
- 首次使用飞书自动化功能
- 登录态过期需要重新登录

## Workflow
### 1. 检查依赖
```bash
node scripts/lib/check-deps.mjs
```

### 2. 启动登录
```bash
node scripts/feishu/feishu-login.mjs [username]
```
浏览器将以 headed 模式打开飞书工作台，用户完成登录后自动保存 session。

### 3. 验证
登录成功后 session 保存到 `auth/` 目录，后续脚本自动复用。

## Notes
- 执行角色: sp-tester（需要 Bash 权限）
- 需要 headed 浏览器（非 headless）
- Session 最多等待 5 分钟
