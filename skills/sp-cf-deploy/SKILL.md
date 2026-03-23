---
name: sp-cf-deploy
description: Cloudflare Pages 部署
argument-hint: "[env]"
triggers:
  - "cloudflare部署"
  - "hire部署"
---

# SP CF Deploy Skill

部署项目到 Cloudflare Pages。

## Use When
- 部署 hire 项目到 Cloudflare
- 预览环境或生产环境发布

## Applicable Projects
- snapmaker-hire (招聘平台)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取 hire 项目根目录。

### 2. 构建
```bash
cd <project-root>
npm run build
```

### 3. 部署
```bash
npm run deploy
```

## Notes
- 执行角色: sp-coder (构建), sp-team-lead (协调部署)
- 权限约束: sp-coder 需 worktree 隔离
- 需要 Cloudflare API Token 配置
