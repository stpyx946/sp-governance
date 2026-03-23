---
name: sp-electron-build
description: Electron 应用打包
argument-hint: "[platform]"
triggers:
  - "electron打包"
  - "luban build"
---

# SP Electron Build Skill

执行 Electron 桌面应用打包。

## Use When
- 需要打包 Luban 桌面应用
- 验证 Electron 主进程/渲染进程编译

## Applicable Projects
- Luban (Snapmaker Luban 桌面软件)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取 Luban 根目录。

### 2. 安装依赖
```bash
cd <project-root>
npm install
```

### 3. 执行构建
```bash
npm run build
```

## Notes
- 执行角色: sp-coder
- 权限约束: sp-coder 需 worktree 隔离
- 完整打包需要平台特定工具链 (electron-builder)
