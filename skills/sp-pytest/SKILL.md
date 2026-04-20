---
name: sp-pytest
description: Pytest 测试执行
argument-hint: "[file|marker]"
triggers:
  - "pytest"
  - "api测试"
---

# SP Pytest Skill

执行 Python pytest 测试。

## Use When
- 运行 Python 项目测试
- 执行 API 接口测试

## Applicable Projects
- Snapmaker_Script (Python 工具脚本)
- api-test (API 测试集)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 执行测试
```bash
cd <project-root>
pytest
```

### 3. 详细输出
```bash
pytest -v --tb=short
```

## ECC 增强

当 ECC 可用时，本 Skill 执行前会自动注入以下 ECC 领域知识:
- **tdd-workflow**: TDD 工作流最佳实践
- **python-patterns**: Python 编码模式与惯用法

注入方式: 上下文 (context) — 编写 Python 测试时参考最佳实践。
ECC 不可用时本 Skill 独立运行，功能不受影响。

## Notes
- 执行角色: sp-tester
- 权限约束: sp-tester 拥有全权限
- 支持 -k 按关键字筛选, -m 按标记筛选
