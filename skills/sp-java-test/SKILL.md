---
name: sp-java-test
description: Maven 单元测试执行
argument-hint: "[module|class]"
triggers:
  - "java测试"
  - "mvn test"
---

# SP Java Test Skill

执行 Maven 单元测试。

## Use When
- 运行 Java 项目单元测试
- 验证代码变更未引入回归

## Applicable Projects
- snapmaker-auth (认证服务)
- snapmaker-micro (微服务)

## Workflow
### 1. 确认项目路径
读取 portfolio.json 获取目标项目根目录。

### 2. 执行测试
```bash
cd <project-root>
mvn test
```

### 3. 分析结果
检查 surefire-reports 目录下测试报告。

## Notes
- 执行角色: sp-tester
- 权限约束: sp-tester 拥有全权限
- 可指定 -Dtest=ClassName 运行单个测试类
