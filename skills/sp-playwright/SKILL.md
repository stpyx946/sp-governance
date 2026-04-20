---
name: sp-playwright
description: Playwright E2E 端到端测试
argument-hint: "[spec]"
triggers:
  - "e2e测试"
  - "playwright test"
---

# SP Playwright Skill

执行 Playwright 端到端测试。

## Use When
- 运行浏览器自动化 E2E 测试
- 验证完整用户流程

## Applicable Projects
- snapmaker-hire (招聘平台)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取 hire 项目根目录。

### 2. 安装浏览器
```bash
npx playwright install
```

### 3. 执行测试
```bash
cd <project-root>
npx playwright test
```

## ECC 增强

当 ECC 可用时，本 Skill 执行前会自动注入以下 ECC 领域知识:
- **e2e-testing**: 端到端测试最佳实践（Page Object 模式、测试隔离、等待策略）

注入方式: 上下文 (context) — E2E 测试编写参考。
ECC 不可用时本 Skill 独立运行，功能不受影响。

## Notes
- 执行角色: sp-tester
- 权限约束: sp-tester 拥有全权限
- E2E 测试需要运行中的开发服务器或测试环境
