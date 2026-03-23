---
name: sp-python-lint
description: Python 代码规范检查
argument-hint: "[path]"
triggers:
  - "python lint"
  - "flake8"
---

# SP Python Lint Skill

执行 Python 代码格式和规范检查。

## Use When
- Python 代码提交前规范检查
- 验证代码格式一致性

## Applicable Projects
- Snapmaker_Script (Python 工具脚本)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 格式检查
```bash
cd <project-root>
black --check .
```

### 3. 规范检查
```bash
flake8 .
```

## Notes
- 执行角色: sp-tester
- 权限约束: sp-tester 拥有全权限
- 可使用 black --diff 查看格式差异
