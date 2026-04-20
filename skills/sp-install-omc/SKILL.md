---
name: sp-install-omc
description: 引导安装 oh-my-claudecode (OMC) 编排层
triggers:
  - "安装OMC"
  - "install omc"
  - "安装编排"
---

# SP Install OMC

引导安装 oh-my-claudecode 作为 SP 的编排层。

## Use When

- SP 检测到 OMC 未安装时的引导
- 用户主动要求安装 OMC
- 升级 OMC 版本

## Workflow

### 0. 获取数据

运行脚本获取真实安装状态：
```bash
node <sp-governance-path>/skills/sp-install-omc/check.mjs
```
基于脚本输出的 JSON 数据进行后续分析和回答。

### 1. 检测现有安装

检查以下路径是否存在 OMC:
- ~/.claude/plugins/oh-my-claudecode
- ~/.claude/plugins/cache/oh-my-claudecode

### 2. 如果已安装

读取版本号，检查兼容性。输出:
```
OMC 已安装: v{version}
兼容性: ✓ / ✗ (SP 要求 >= 1.0.0)
```

### 3. 如果未安装

提示用户执行 OMC 安装命令:
```
建议安装方式:
  claude plugin install oh-my-claudecode
  
或通过 OMC setup:
  /oh-my-claudecode:omc-setup
```

### 4. 安装后验证

安装完成后重新探测，确认可用。更新 .sp/integration.json。

### 5. 输出安装结果

```
OMC 安装完成
版本: v{version}
状态: ✓ active
SP 运行模式已升级: sp-only → sp-omc
```

## Notes

- SP 不直接执行安装命令，只提供引导信息
- 安装由用户或 Claude Code 原生机制完成
