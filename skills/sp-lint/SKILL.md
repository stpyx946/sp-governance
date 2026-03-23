---
name: sp-lint
description: 多项目代码规范检查
argument-hint: "[project]"
triggers:
  - "lint检查"
  - "代码规范"
---

# SP Lint Skill

执行代码规范检查，适配不同项目的 lint 工具。

## Use When
- 代码提交前检查规范
- CI 流程中的代码质量门禁

## Applicable Projects
- snapmaker-hire: ESLint
- snapmaker-admin: Biome
- sm-nuxt3-website: Prettier
- Luban: ESLint

## Workflow
### 1. 确认项目和工具
读取 portfolio.json 确定项目，根据技术栈选择 lint 工具。

### 2. 执行检查
```bash
# hire / Luban
npx eslint .

# admin
npx biome check .

# website
npx prettier --check .
```

## Notes
- 执行角色: sp-tester (执行), sp-reviewer (只读审查结果)
- 权限约束: sp-reviewer 禁止 Edit/Write/Bash，仅分析输出
