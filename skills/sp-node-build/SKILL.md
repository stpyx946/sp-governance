---
name: sp-node-build
description: Node.js 项目构建
argument-hint: "[project]"
triggers:
  - "node构建"
  - "npm build"
---

# SP Node Build Skill

执行 Node.js 项目构建。

## Use When
- 需要构建 Node.js/TypeScript 项目
- 验证前端或后端 Node 项目是否可编译

## Applicable Projects
- snapmaker-hire (Nuxt3 招聘平台)
- snapmaker-admin (后台管理)
- api-server (API 服务)
- monitor (监控平台)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 安装依赖
```bash
cd <project-root>
npm install
```

### 3. 执行构建
```bash
npm run build
```

## ECC 增强

当 ECC 可用时，本 Skill 执行前会自动注入以下 ECC 领域知识:
- **frontend-patterns**: 前端构建优化模式（Tree-shaking、代码分割、缓存策略）

注入方式: 上下文 (context) — 构建优化参考。
ECC 不可用时本 Skill 独立运行，功能不受影响。

## Notes
- 执行角色: sp-coder (构建), sp-tester (测试构建)
- 权限约束: sp-coder 需 worktree 隔离
- 部分项目使用 pnpm 或 yarn，需根据 lock 文件判断
