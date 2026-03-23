# 升级决策规则

> 本文件定义什么情况需要上报什么级别。

## 升级级别

### Level 0 - 角色内自决
无需上报, 角色自行决策。

适用场景:
- Coder 选择实现方式 (在 Architect 设计范围内)
- Tester 选择测试框架和用例组织方式
- Doc Engineer 选择文档格式和结构
- TeamLead 在上限内调配团队人数

### Level 1 - 上报 Architect
Coder 或 Tester 遇到技术不确定时上报。

> **Lite 模式**: 无 Architect 角色，Level 1 直接上报 PM。

适用场景:
- Coder 遇到不确定的接口修改
- Coder 发现设计方案有歧义
- Tester 发现测试覆盖与设计方案冲突
- Coder 发现设计遗漏的边界情况

### Level 2 - 上报 TeamLead
Architect 之间或 Architect 与 Reviewer 之间分歧时上报。

> **Lite 模式**: 无 TeamLead/Architect/Reviewer 角色，Level 2 直接上报 PM。

适用场景:
- Architect 之间方案分歧无法收敛
- Reviewer 否决了 Architect 的方案
- 任务需要调整团队人数
- Agent 异常 (超时/失败) 的处理决策

### Level 3 - 上报 Group-Lead 或 PM
任务超出项目范围时上报。

适用场景:
- 任务可能涉及其他项目
- TeamLead 资源不足
- 发现架构级风险
- Agent 连续失败需要降级

### Level 4 - 上报用户 (必须审批)
以下操作必须经用户明确批准后才能执行:

```
必须用户审批:
  ✓ 数据库表结构变更 (新建/修改/删除表、字段、索引)
  ✓ 入库数据格式变更
  ✓ 修改 governance/ 下任何文件
  ✓ 修改 .claude/agents/ 下的角色定义
  ✓ 任何角色的越权操作 (被系统或审计发现)
  ✓ 跨项目/跨组接口契约变更
  ✓ 删除文件/分支等不可逆操作
  ✓ PM 自身违反宪法的操作
  ✓ 需求间逻辑冲突 (两个需求业务逻辑矛盾)
  ✓ 并发 Agent 数即将超过 20
  ✓ 自动优化每轮方案选择
  ✓ 验收多次 REJECTED 后的处置决策

不需要用户审批:
  ✗ Bug 修复 (不涉及表结构)
  ✗ 新增 API (不涉及表结构)
  ✗ 代码重构
  ✗ 测试编写
  ✗ 文档更新
  ✗ 依赖升级
  ✗ 团队人数调配 (在上限内)
  ✗ 文件冲突 (技术性合并)
  ✗ 接口冲突 (Architect 重新设计)
  ✗ Agent 首次异常的重试
  ✗ 验收失败的首次打回修复
```
