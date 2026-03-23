---
name: sp-nuxt-build
description: Nuxt3 官网静态生成
argument-hint: "[env]"
triggers:
  - "nuxt构建"
  - "官网构建"
---

# SP Nuxt Build Skill

执行 Nuxt3 官网项目静态生成。

## Use When
- 需要生成官网静态页面
- 部署前验证 SSG 输出

## Applicable Projects
- sm-nuxt3-website (Snapmaker 官网)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取 sm-nuxt3-website 根目录。

### 2. 安装依赖
```bash
cd <project-root>
yarn install
```

### 3. 执行生成
```bash
yarn home-generate:prod
```

### 4. 验证产物
检查 .output/ 目录下是否生成静态文件。

## Notes
- 执行角色: sp-coder (构建), sp-tester (验证)
- 权限约束: sp-coder 需 worktree 隔离
- 生成过程内存消耗较大，注意 Node 内存限制
