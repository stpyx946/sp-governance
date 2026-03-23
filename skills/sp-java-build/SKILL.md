---
name: sp-java-build
description: Maven 构建 Java 项目
argument-hint: "[module]"
triggers:
  - "java构建"
  - "maven build"
---

# SP Java Build Skill

执行 Maven 构建流程，支持多模块项目。

## Use When
- 需要编译打包 Java 项目
- 验证 Java 代码是否可编译通过

## Applicable Projects
- snapmaker-parent (父 POM)
- snapmaker-auth (认证服务)
- snapmaker-micro (微服务)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 执行构建
```bash
cd <project-root>
mvn clean package -DskipTests
```

### 3. 验证产物
检查 target/ 目录下是否生成 JAR/WAR 文件。

## Notes
- 执行角色: sp-coder (构建), sp-tester (测试构建)
- 权限约束: sp-coder 需 worktree 隔离
- 首次构建可能需要下载依赖，耗时较长
