---
name: sp-python-setup
description: Python 环境安装配置
argument-hint: "[project]"
triggers:
  - "python安装"
  - "pip install"
---

# SP Python Setup Skill

配置 Python 项目开发环境。

## Use When
- 初始化 Python 项目依赖
- 配置虚拟环境

## Applicable Projects
- Snapmaker_Script (Python 工具脚本)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 创建虚拟环境
```bash
cd <project-root>
python -m venv .venv
source .venv/bin/activate
```

### 3. 安装依赖
```bash
pip install -e .
```

## Notes
- 执行角色: sp-coder (安装), sp-tester (验证)
- 权限约束: sp-coder 需 worktree 隔离
- 需确认 Python 版本兼容性
