---
name: sp-uninstall
description: Completely uninstall SP Governance — removes all plugin files, config, state, and registry entries
argument-hint: "[--dry-run]"
triggers:
  - "卸载SP"
  - "卸载sp"
  - "uninstall SP"
  - "uninstall sp"
  - "remove SP"
  - "remove sp"
  - "删除SP"
  - "删除sp"
---

# SP Uninstall Skill

Completely removes SP Governance from the workspace and system.

## Use When

- User wants to uninstall / remove SP governance plugin entirely
- User says "卸载SP", "uninstall SP", "remove SP", "删除SP"

## Workflow

### 1. Confirm with User

Before proceeding, confirm:

> 即将彻底卸载 SP Governance，将清理以下内容：
> - `~/.claude/CLAUDE.md` 中的 SP 配置块
> - 工作空间 `CLAUDE.md` 中的 SP 配置块
> - `portfolio.json` 项目注册表
> - `.omc/bootstrap-state.json` 启动状态
> - `~/.claude/plugins/sp-governance/` 已安装插件
> - `~/.claude/plugins/marketplaces/sp-governance/` Marketplace 注册
> - `~/.claude/plugins/cache/sp-governance/` 插件缓存
> - `~/.claude/plugins/installed_plugins.json` 中的 SP 条目
> - SP 审计日志
>
> 此操作不可逆。是否继续？

### 2. Preview (Dry Run)

First run dry-run to show what will be cleaned:

```bash
node sp-governance/scripts/sp-uninstall.mjs --dry-run
```

Show the output to the user.

### 3. Execute Full Uninstall

If user confirms:

```bash
node sp-governance/scripts/sp-uninstall.mjs
```

### 4. Report

Show the cleanup report. Remind the user:
- Restart Claude Code for changes to take effect
- The `sp-governance/` source directory itself is NOT deleted (it's part of the repo, user can remove manually if desired)
