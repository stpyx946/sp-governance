---
name: sp-learning-status
description: 查看 ECC 持续学习状态和已学习的模式
triggers:
  - "学习状态"
  - "learning status"
  - "已学习模式"
---

# SP Learning Status

查看 ECC 持续学习系统的状态和已积累的模式。

## Use When

- 想了解 ECC 学习了哪些编码模式
- 检查持续学习功能是否正常运行
- 查看某个项目积累的学习数据

## Workflow

### 0. 获取数据

运行脚本获取学习状态数据：
```bash
node <sp-governance-path>/skills/sp-learning-status/check.mjs
```
基于脚本输出的 JSON 数据进行后续分析和回答。

### 1. 检测学习系统

检查 ECC 是否安装且学习功能可用:
- ECC 安装路径
- 学习数据版本 (v1/v2)
- 学习数据目录

### 2. 读取全局 Instincts

读取所有已学习的模式，按置信度排序显示:
```
已学习模式 (按置信度排序):
  [0.95] 该项目的测试优先使用 vitest 而非 jest
  [0.87] 提交前总是运行 typecheck
  [0.72] 组件文件使用 PascalCase 命名
```

### 3. 项目级学习数据

如果指定了项目名，筛选与该项目相关的学习:
```
项目 "AutoAIPost" 的学习数据:
  [0.90] Vue 组件使用 setup script 语法
  [0.85] 样式使用 Tailwind 而非 scoped CSS
```

### 4. 输出报告

```
ECC 持续学习状态
==================
ECC 版本:     v1.10.0
学习系统:     v2 (homunculus)
状态:         ✓ active
已学习模式:   N 条
高置信度 (>0.8): N 条

全局模式:
  1. [0.95] ...
  2. [0.87] ...
```

## Notes

- 只读操作
- ECC 未安装时提示安装
- 学习数据格式可能随 ECC 版本变化
