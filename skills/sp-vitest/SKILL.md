---
name: sp-vitest
description: Vitest 单元测试
argument-hint: "[file|pattern]"
triggers:
  - "vitest"
  - "hire单测"
---

# SP Vitest Skill

执行 Vitest 单元测试。

## Use When
- 运行前端组件或工具函数单测
- 验证 hire 项目代码变更

## Applicable Projects
- snapmaker-hire (招聘平台)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取 hire 项目根目录。

### 2. 执行测试
```bash
cd <project-root>
npx vitest run
```

### 3. 分析覆盖率
```bash
npx vitest run --coverage
```

## Notes
- 执行角色: sp-tester
- 权限约束: sp-tester 拥有全权限
- 支持 --reporter=verbose 查看详细输出
