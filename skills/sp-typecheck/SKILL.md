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

## ECC 增强

当 ECC 可用时，本 Skill 执行前会自动注入以下 ECC 领域知识:
- **typescript-patterns**: TypeScript 类型系统高级模式（泛型、条件类型、工具类型）

注入方式: 参考 (reference) — 修复类型错误时参考高级模式。
ECC 不可用时本 Skill 独立运行，功能不受影响。

## Notes
- 执行角色: sp-tester (执行), sp-coder (修复类型错误)
- 权限约束: sp-coder 需 worktree 隔离
