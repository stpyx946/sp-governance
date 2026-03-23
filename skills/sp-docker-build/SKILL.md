---
name: sp-docker-build
description: Docker 镜像构建
argument-hint: "[project|tag]"
triggers:
  - "docker构建"
  - "镜像构建"
---

# SP Docker Build Skill

构建项目 Docker 镜像。

## Use When
- 需要构建部署用 Docker 镜像
- 验证 Dockerfile 配置正确性

## Applicable Projects
- snapmaker-auth (Java 服务)
- snapmaker-micro (Java 服务)
- monitor (Node.js 服务)
- api-server (Node.js 服务)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 构建镜像
```bash
cd <project-root>
docker build -t <project-name>:<tag> .
```

### 3. 验证镜像
```bash
docker images | grep <project-name>
```

## Notes
- 执行角色: sp-coder (构建), sp-team-lead (协调)
- 权限约束: sp-coder 需 worktree 隔离
- 需要 Docker daemon 运行中
