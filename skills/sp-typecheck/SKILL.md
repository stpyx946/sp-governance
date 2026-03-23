---
name: sp-typecheck
description: TypeScript 类型检查
argument-hint: "[project]"
triggers:
  - "类型检查"
  - "tsc check"
---

# SP Typecheck Skill

执行 TypeScript 类型检查。

## Use When
- 验证 TypeScript 类型正确性
- 代码提交前的类型安全检查

## Applicable Projects
- snapmaker-hire (Nuxt3/Vue3 + TS)
- snapmaker-admin (React + TS)
- Luban (Electron + TS)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 执行类型检查
```bash
cd <project-root>
npx tsc --noEmit
```

## Notes
- 执行角色: sp-tester (执行), sp-coder (修复类型错误)
- 权限约束: sp-coder 需 worktree 隔离
