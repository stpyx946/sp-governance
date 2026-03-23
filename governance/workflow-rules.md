# 工作流规则

> 本文件定义任务从接收到完成的全流程规则。
> OMC 融合调度规则 (能力探测、任务分流、执行模式、角色映射) 见 `CLAUDE.md` 第三节"OMC 融合调度"。

## 一、治理模式 (governance_mode)

portfolio.json 的 `governance_mode` 字段统一为 auto，无需手动指定。

```
auto 模式:
  适用: 任何规模，PM 按任务自动判定治理级别
  判定规则:
    1. 用户声明"紧急"/"hotfix" → 紧急通道 (等同 lite)
    2. ≤1 文件 + 明确任务 + 不涉及接口/安全 → lite 级 (直通通道)
    3. ≤3 文件 + 不涉及跨项目 → lite 级 (快速通道，PM 兼任 TeamLead)
    4. ≤10 文件 或 涉及接口变更 → standard 级 (标准通道)
    5. >10 文件 或 跨模块/架构决策/安全修复 → full 级 (完整通道)
  优势: 简单任务零开销，复杂任务自动升级保障质量
```

## 二、任务分级与通道选择

### 测试强制规则 (适用于所有通道，含 lite/express/hotfix; spike 通道豁免但转正式时补)

```
每个需求必须有对应的测试用例，无测试 = 验收 REJECTED。

Gate 2 最低要求: 新增/修改的代码必须有对应测试
Gate 2 判定标准:
  · 新增功能: 至少 1 个单元测试覆盖核心路径
  · Bug 修复: 至少 1 个回归测试验证修复
  · 重构: 现有测试全部通过 (无新增测试要求)
  · 配置变更: Gate 2 可豁免 (标注原因)
  · 无测试 + 非配置变更 = REJECTED，打回 Phase 2
```

### 级别参考
C 级项目 (≤20 文件) 优先走直通/快速通道; A 级项目 (>100 文件) 优先走标准/完整通道。级别仅为参考，最终通道由影响文件数决定。

```
直通通道 (Express):
  条件: 影响 ≤1 个文件, 不涉及接口变更, 用户明确指定项目和任务
  团队: PM 直接生成 Coder (跳过 TeamLead)
  跳过: TeamLead, Architect, Reviewer
  验收: Gate 1 (构建) + Gate 2 (最小测试)
  适用: 一行 Bug Fix, 配置修改, 依赖版本更新, 格式修复

快速通道 (Simple):
  条件: 影响 ≤3 个文件, 不涉及接口变更
  团队: TeamLead + Coder + Tester
  跳过: Architect 设计, Reviewer 方案审查
  保留: 代码审查 (TeamLead 兼任), 验收质量关

标准通道 (Standard):
  条件: 影响 ≤10 个文件, 涉及接口或模块变更
  团队: TeamLead + Architect + Coder(s) + Reviewer + Tester + Doc Engineer(可选)
  完整流程: 设计→方案审查→实现→代码审查→验收→收尾

完整通道 (Full):
  条件: 影响 >10 个文件, 跨模块/跨项目, 架构决策
  团队: TeamLead + Architect×2 + Coder(s)×3 + Reviewer + Tester + Doc Engineer
  额外: 双 Architect 并行出方案 → Reviewer 仲裁 → 用户确认

紧急通道 (Hotfix):
  条件: 用户声明"紧急"/"hotfix"/"生产问题"
  团队: PM 直接生成 Coder + Tester (跳过 TeamLead/Architect/Reviewer)
  流程: Coder 在 hotfix/ 分支修复 → Tester 仅执行 Gate 1 + Gate 2 → 完成
  事后: 标记"待补审", 记录到 active-requirements.json
  补审: 下次非紧急任务启动前, Reviewer 补充完整审查

探索通道 (Spike):
  条件: 用户声明"探索"/"原型"/"spike"/"试试"/"验证可行性"
  团队: PM 先派 Architect(haiku) 做轻量扫描 → 再派 Coder
  分支: spike/{描述} (非 feature 分支)
  测试: Gate 2 标记 deferred (暂缓，转正式时补)
  验收: 仅 Gate 1 (能构建即可)
  时间盒: 默认 2 小时 (可在任务中指定)
  产出状态: draft (草稿) — 不可合并到 main
  后续:
    · 探索成功 → 用户决定转正式需求 (新开 feature 分支, 补测试+审查)
    · 探索失败/放弃 → 删除 spike 分支
    · 超过时间盒 → PM 提醒用户决策 (继续/转正式/放弃)
```

## 三、完整工作流

```
Phase 1: 设计 (标准/完整通道)
  · Architect(s) 阅读代码, 出设计方案
  · 完整通道: 并行双 Architect → Reviewer 仲裁
  · 输出影响范围 → 登记到 active-requirements.json
  · 不确定的点 → 上报用户确认
  · 涉及表结构 → 必须用户确认
  · 方案确定 → 进入实现

Phase 2: 实现
  · Coder(s) 在独立分支并行实现
  · Tester 同步编写测试
  · Doc Engineer 同步准备文档
  · Coder 不确定 → 上报 Architect 决策
  · Agent 异常 → 健康监控介入

Phase 3: 代码审查
  · Reviewer 审查代码/测试/文档
  · Reviewer 检查跨需求兼容性
  · 不通过 → 打回 Phase 2
  · 通过 → 进入验收

Phase 3.5: 验收质量关
  · Gate 1: 构建验证 (编译零错误)
  · Gate 2: 测试验证 (全量测试零失败)
  · Gate 3: 运行验证 (服务可启动, API 可用)
  · Gate 4: 回归验证 (零回归, 下游项目通过)
  · REJECTED → 打回 Phase 2, 修复后从 Gate 1 重新验收
  · ACCEPTED → 进入收尾

Phase 4: 收尾
  · 跨组需求 → Cross-Reviewer 一致性审查
  · 存储验收报告 (.omc/acceptance-reports/)
  · 更新项目记忆 (project-memory.json)
  · 更新需求登记表 (active-requirements.json)
  · 释放团队成员
  · 上报 PM → PM 向用户报告 (含验收数据)
```

## 四、多需求并行规则

```
· 每个需求在独立 Git 分支开发
· Reviewer 项目内共享 (跨需求全局视角)
· Doc Engineer 项目内共享
· 新需求启动前必须做冲突预检 (读取 active-requirements.json)
· 需求并行数 ≥2 时, TeamLead 定期执行分支集成检测
· 每项目最多 3 个并行需求
```

## 五、跨项目/跨组规则

```
组内跨项目:
  · Group-Lead 协调, 不需要 Cross-Architect
  · Group-Lead 定义组内接口契约
  · 各 TeamLead 按契约并行执行
  · 完成后 Group-Lead 做一致性审查

跨组:
  · PM 激活 Cross-Architect 定义组间契约
  · 各 Group-Lead 按契约在组内拆解
  · 完成后 Cross-Reviewer 做一致性审查

Monorepo 内跨包:
  · 类似组内跨项目，但 worktree 隔离的是整个仓库
  · Coder 的 project_paths 包含主包 + shared_deps 路径
  · 构建按 build_order 拓扑顺序执行
  · Gate 4 回归验证覆盖 shared_deps 的所有下游包
```

## 六、多项目并行执行模型

### Agent 预算分配

总预算 20 个 Agent，按以下规则分配:

```
固定开销:
  PM: 1 (常驻)
  Group-Lead: 1/活跃组 (最多 2)
  Cross-Architect/Reviewer: 0~2 (仅跨组任务时)

项目可用预算 = 20 - 固定开销
  示例: 1 组 + 1 standalone = 20 - 1(PM) - 1(GL) = 18 给项目团队
  示例: 2 组活跃 = 20 - 1(PM) - 2(GL) = 17 给项目团队

每项目配置:
  最小 (直通/快速): Coder(1) 或 TeamLead(1) + Coder(1) = 1~2
  标准: TeamLead(1) + Coder(1) + Tester(1) + Architect(共享) = 3~4
  完整: TeamLead(1) + Architect(1~2) + Coder(1~3) + Reviewer(1) + Tester(1) = 5~8
```

### 同组多项目并行

Group-Lead 协调组内多项目同时执行:

```
1. 接收 PM 的组级任务 (可涉及多个项目)
2. 评估 Agent 预算 → 决定并行度:
   - 预算充足 → 所有项目同时启动
   - 预算紧张 → 按优先级分批，高优先级先启动
3. 各 TeamLead 独立管理项目内的多需求并行
4. 组内共享资源:
   - Reviewer 在组内跨项目共享 (全局视角)
   - Doc Engineer 在组内共享
5. 进度对齐: Group-Lead 监控各项目进度，确保接口一致
```

### 跨组多项目并行

PM 协调多组同时执行:

```
1. PM 激活 Cross-Architect 定义组间接口契约
2. 契约确定 → 各组并行执行 (Group-Lead 各自调度)
3. 同步点: 所有组完成实现 → Cross-Reviewer 统一审查
4. 审查通过 → 各组独立验收
```

### 跨项目需求 (单需求涉及多项目)

```
1. PM/Group-Lead 识别需求涉及的所有项目
2. 拆解为各项目子任务，标记依赖关系:
   - 无依赖 → 并行执行
   - 有依赖 (A 的接口定义 → B 的消费实现) → 串行: A 先完成 → B 启动
3. 所有子任务完成 → 统一验收 (Gate 4 回归验证覆盖所有涉及项目)
4. 任一项目验收失败 → 全部暂停，定位问题后重新验收
```

## 七、多需求多项目并行模型

多个需求同时进行，每个需求可能涉及多个项目。这是最复杂的执行场景。

### 全局需求矩阵

PM 维护需求-项目矩阵，识别交叉点:

```
示例:
              auth    micro    hire
  REQ-001      ✓        ✓       ✓      ← 跨 3 个项目
  REQ-002               ✓              ← 单项目
  REQ-003      ✓                 ✓      ← 跨 2 个项目
               ↑                 ↑
         2需求重叠          2需求重叠 → 冲突热点
```

每个 ✓ 是一个「子任务」，有独立分支: feature/{req-id}/{描述}

### 冲突热点检测

PM 在需求启动前扫描矩阵:

```
1. 列扫描: 同一项目被多个需求同时修改
   · auth: REQ-001 + REQ-003 → 冲突热点
   · hire: REQ-001 + REQ-003 → 冲突热点
   · micro: REQ-001 + REQ-002 → 检查影响文件是否交叉

2. 热点评估:
   · 影响文件无交叉 → 可并行 (不同模块)
   · 影响文件有交叉 → 冲突风险，选择策略:
     a. 串行: 一个需求先做，另一个等
     b. 并行 + 强隔离: Architect 预先划定边界，Reviewer 重点审查交叉区
     c. 合并: 两个需求合为一个联合需求统一实现

3. 策略选择 → 用户确认
```

### 执行编排

```
Phase 0: 全局规划
  · PM 建立需求矩阵
  · PM 检测冲突热点 → 确定执行策略 → 用户确认
  · PM 分配 Agent 预算 (见预算分配规则)

Phase 1: 按需求拆解
  每个需求拆解为各项目子任务:
  · REQ-001 → auth-001 (API) + micro-001 (处理) + hire-001 (UI)
  · REQ-003 → auth-003 (OAuth) + hire-003 (登录)
  标记子任务间依赖: auth-001 (API 定义) → micro-001 + hire-001

Phase 2: 下发执行
  同组: Group-Lead 接收本组所有需求的子任务，统一调度
  跨组: PM 拆分到各组，Group-Lead 各自管理

  每个项目 TeamLead 收到该项目的所有子任务:
  · auth-lead 收到: auth-001 + auth-003 (2 个需求并行)
  · micro-lead 收到: micro-001 + micro-002 (2 个需求并行)
  · hire-lead 收到: hire-001 + hire-003 (2 个需求并行)

  每个子任务在独立分支执行 (worktree 隔离):
  · auth: feature/req-001-device-api, feature/req-003-oauth-provider
  · micro: feature/req-001-device-handler, feature/req-002-mqtt-fix

Phase 3: 冲突监控 (持续)
  TeamLead 层 (项目内):
  · 同项目多需求的分支集成检测 (git merge --no-commit)
  · 发现文件冲突 → Architect 介入划定边界

  Group-Lead 层 (组内):
  · 跨项目接口对齐: REQ-001 的 auth API 变更是否影响 REQ-003 的 auth OAuth?
  · 进度同步: REQ-001 的上游任务完成 → 通知下游项目启动

  PM 层 (全局):
  · 需求矩阵状态更新
  · 跨组依赖追踪

Phase 4: 验收
  每个需求独立验收 (所有子任务完成后):
  · REQ-001: auth-001 + micro-001 + hire-001 全部通过 → REQ-001 ACCEPTED
  · Gate 4 回归: 验证本需求是否破坏其他需求的已完成代码

  所有需求验收通过 → 收尾
```

### active-requirements.json 结构 (增强版)

每个项目的 active-requirements.json 包含跨项目感知:

```json
{
  "project": "snapmaker-auth",
  "requirements": [
    {
      "id": "REQ-001",
      "title": "新增设备类型支持",
      "priority": "P0",
      "source": "user_request",
      "branch": "feature/req-001-device-api",
      "status": "in_progress",
      "pending_review": false,
      "affected_files": ["src/device/DeviceController.java"],
      "cross_project": {
        "also_affects": ["snapmaker-micro", "snapmaker-hire"],
        "dependencies": {
          "upstream": [],
          "downstream": ["micro-001", "hire-001"]
        }
      }
    },
    {
      "id": "REQ-003",
      "title": "新增 OAuth2 Provider",
      "priority": "P1",
      "source": "security_audit",
      "branch": "feature/req-003-oauth-provider",
      "status": "in_progress",
      "pending_review": false,
      "affected_files": ["src/oauth/OAuthController.java"],
      "cross_project": {
        "also_affects": ["snapmaker-hire"],
        "dependencies": {
          "upstream": [],
          "downstream": ["hire-003"]
        }
      }
    }
  ],
  "conflict_hotspots": [
    {
      "file": "src/config/SecurityConfig.java",
      "requirements": ["REQ-001", "REQ-003"],
      "resolution": "parallel_with_boundary",
      "boundary_note": "REQ-001 改设备认证部分, REQ-003 改 OAuth 部分"
    }
  ]
}
```

### 分批执行策略 (Agent 预算不足时)

```
预算不足以支撑所有项目同时运行:

批次 1: 上游项目 / 高优先级 → 执行 → 释放 Agent
批次 2: 下游项目 / 中优先级 → 执行 → 释放 Agent
批次 3: 低优先级 → 执行

同一批次内并行，批次间串行。
优先级判定: 被依赖项目 > 依赖项目, 用户指定 > 系统判定。
```

## 八、自动优化循环

```
触发: 用户说 "自动优化" / "持续优化"
停止: 用户说 "停止优化" / 无更多优化项

循环:
  Step 1: Architect 分析 (代码质量/性能/安全/架构/测试/依赖)
  Step 2: 输出优化方案 (按优先级排序)
  Step 3: 用户选择本轮执行项
  Step 4: 按标准流程执行 (含验收质量关)
  Step 5: 总结 → 自动回到 Step 1
```

## 九、部署与交付

### 部署流程 (验收通过后)

```
Phase 5: 部署
  · 部署决策由用户触发 (PM 不自主部署)
  · PM 输出部署清单:
    - 哪些项目有变更
    - 构建产物位置
    - 部署命令 (参考 portfolio.json 中的 deploy_command, 如有)
  · 用户确认 → 执行部署
  · 部署后: 烟雾测试 (health check)
    - 成功 → 收尾
    - 失败 → 回滚
```

### 回滚协议

```
部署失败:
  1. 使用上一个稳定版本回滚
  2. 上报 PM → PM 标记需求为 "deploy_failed"
  3. 分析失败原因 → 重新进入修复流程

回滚触发条件:
  · 服务启动失败
  · 烟雾测试不通过
  · 用户主动要求回滚
```

### portfolio.json 部署字段 (可选)

```json
{
  "deploy_command": "docker-compose up -d",
  "health_check": "curl -f http://localhost:8080/actuator/health"
}
```

项目未配置 deploy_command 时, PM 根据技术栈推断:
- java_maven → `docker-compose up -d` 或用户指定
- nextjs → `npm run deploy` 或 `wrangler deploy`
- 未知 → 询问用户
