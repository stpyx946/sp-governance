# SP Governance v7.3.0 — 完整能力与技能全景图

> 基于项目实际文件和配置生成，反映 sp-governance 插件的真实能力状态。
>
> 生成日期: 2026-04-02

---

## 一、架构总览

```mermaid
flowchart TB
    User["用户"]
    PM["PM (Portfolio Manager)<br/>全局调度者"]
    
    subgraph Hooks["Hook 拦截链"]
        H1["sp-bootstrap-guard<br/>UserPromptSubmit"]
        H2["sp-pm-allowlist-guard<br/>PreToolUse: *"]
        H3["sp-route-guard<br/>PreToolUse: Agent"]
        H4["sp-destructive-guard<br/>PreToolUse: Bash"]
    end

    subgraph Governance["治理规则 governance/"]
        G1["role-permissions.md<br/>角色权限矩阵"]
        G2["workflow-rules.md<br/>通道与工作流"]
        G3["escalation-rules.md<br/>升级决策 L0-L4"]
        G4["violation-protocol.md<br/>违规检测 V1-V4"]
        G5["health-monitoring.md<br/>超时·巡检·恢复"]
    end

    subgraph Agents["Agent 角色体系 (9 个)"]
        direction LR
        A_RO["只读角色"]
        A_RW["读写角色"]
    end

    subgraph Skills["Skills (39 个)"]
        direction LR
        SK_GOV["治理类"]
        SK_BUILD["构建/测试类"]
        SK_FEISHU["飞书自动化"]
        SK_ANALYSIS["分析类"]
        SK_DEPLOY["部署类"]
    end

    User --> PM
    PM --> Hooks
    PM --> Agents
    PM --> Skills
    Hooks -.-> Governance
    Agents -.-> Governance
```

---

## 二、Agent 角色体系

```mermaid
flowchart LR
    subgraph 只读分析["只读角色 (禁止 Edit/Write/Bash)"]
        AR["sp-architect<br/>Opus 4.6<br/>架构分析·设计方案"]
        RV["sp-reviewer<br/>Opus 4.6<br/>代码审查·输出报告"]
        CA["sp-cross-architect<br/>Opus 4.6<br/>组间接口设计"]
        CR["sp-cross-reviewer<br/>Opus 4.6<br/>组间一致性审查"]
    end

    subgraph 有限写入["有限写入角色"]
        GL["sp-group-lead<br/>Sonnet 4.6<br/>组内协调 (禁止 Edit/Write)"]
        DE["sp-doc-engineer<br/>Haiku 4.5<br/>仅写 .md (禁止 Bash)"]
    end

    subgraph 全权限["全权限角色"]
        TL["sp-team-lead<br/>Sonnet 4.6<br/>项目调度"]
        CD["sp-coder<br/>Sonnet 4.6<br/>业务代码 (worktree 隔离)"]
        TS["sp-tester<br/>Sonnet 4.6<br/>测试+验收门禁"]
    end
```

### Agent 详细清单

| Agent | 模型 | 定位 | 物理约束 (disallowedTools) |
|-------|------|------|---------------------------|
| `sp-architect` | claude-opus-4-6 | 只读分析，设计方案 | Edit, Write, Bash, NotebookEdit |
| `sp-reviewer` | claude-opus-4-6 | 只读审查，输出报告 | Edit, Write, Bash, NotebookEdit |
| `sp-cross-architect` | claude-opus-4-6 | 组间接口设计 | Edit, Write, Bash, NotebookEdit |
| `sp-cross-reviewer` | claude-opus-4-6 | 组间一致性审查 | Edit, Write, Bash, NotebookEdit |
| `sp-group-lead` | claude-sonnet-4-6 | 组内协调 | NotebookEdit; prompt 约束仅 groups/ 下文档 |
| `sp-doc-engineer` | claude-haiku-4-5 | 仅写 .md 文档 | Bash; prompt 约束仅 .md 文件 |
| `sp-team-lead` | claude-sonnet-4-6 | 项目调度 | 无; 管理操作自主，代码操作派发给 Coder |
| `sp-coder` | claude-sonnet-4-6 | 业务代码实现 | 无; worktree 隔离，限本项目 |
| `sp-tester` | claude-sonnet-4-6 | 测试编写 + 验收门禁 | 无; prompt 约束限测试文件 |

---

## 三、Skill 分类全景图

```mermaid
mindmap
  root((SP Skills<br/>39 个))
    治理与管理
      sp-bootstrap
      sp-status
      sp-scan
      sp-dispatch
      sp-release
      sp-docs-sync
    架构与分析
      sp-arch-analysis
      sp-api-contract
      sp-dep-graph
      sp-dep-audit
      sp-impact-analysis
      sp-db-check
      sp-code-review
    构建
      sp-node-build
      sp-java-build
      sp-nuxt-build
      sp-docker-build
      sp-electron-build
      sp-cf-deploy
      sp-python-setup
    测试
      sp-jest
      sp-vitest
      sp-pytest
      sp-java-test
      sp-playwright
    代码质量
      sp-lint
      sp-python-lint
      sp-typecheck
      sp-prisma
      sp-deploy-check
    飞书自动化
      sp-feishu-login
      sp-feishu-doc
      sp-feishu-wiki-doc
      sp-feishu-prd
      sp-feishu-weekly
      sp-feishu-member-weekly
      sp-feishu-project-board
      sp-feishu-bitable
      sp-feishu-notify
```

### Skill 完整清单

#### 治理与管理 (6 个)

| Skill | 名称 | 说明 |
|-------|------|------|
| `sp-bootstrap` | 治理诊断 | 完整 SP 治理诊断 — agents、governance 文件、项目目录、漂移检测 |
| `sp-status` | 状态查看 | 快速查看 SP 治理状态 — portfolio 摘要、分组、上次诊断 |
| `sp-scan` | 漂移扫描 | 扫描工作区项目漂移 — 检测新增、删除、变更的项目 |
| `sp-dispatch` | 任务派发 | 快速将任务派发到项目，自动选择正确的 SP agent |
| `sp-release` | 插件发布 | SP governance 插件发布流程 — 版本号、打包、安装、注册 |
| `sp-docs-sync` | 文档同步 | 检查 git 状态，提交并推送 SP 管理项目的文档变更 |

#### 架构与分析 (7 个)

| Skill | 名称 | 说明 |
|-------|------|------|
| `sp-arch-analysis` | 架构分析 | 项目架构分析 |
| `sp-api-contract` | 接口契约 | 跨项目接口契约检查 |
| `sp-dep-graph` | 依赖关系图 | 项目间依赖关系图 |
| `sp-dep-audit` | 依赖审计 | 依赖安全审计 |
| `sp-impact-analysis` | 影响分析 | 变更影响分析 |
| `sp-db-check` | 数据库检查 | 数据库配置与 SQL 分析 |
| `sp-code-review` | 代码审查 | 代码审查 |

#### 构建 (5 个)

| Skill | 名称 | 说明 |
|-------|------|------|
| `sp-node-build` | Node 构建 | Node.js 项目构建 |
| `sp-java-build` | Java 构建 | Maven 构建 Java 项目 |
| `sp-nuxt-build` | Nuxt 构建 | Nuxt3 官网静态生成 |
| `sp-docker-build` | Docker 构建 | Docker 镜像构建 |
| `sp-electron-build` | Electron 打包 | Electron 应用打包 |

#### 测试 (5 个)

| Skill | 名称 | 说明 |
|-------|------|------|
| `sp-jest` | Jest 测试 | Jest 单元测试 |
| `sp-vitest` | Vitest 测试 | Vitest 单元测试 |
| `sp-pytest` | Pytest 测试 | Pytest 测试执行 |
| `sp-java-test` | Java 测试 | Maven 单元测试执行 |
| `sp-playwright` | E2E 测试 | Playwright E2E 端到端测试 |

#### 代码质量与部署 (5 个)

| Skill | 名称 | 说明 |
|-------|------|------|
| `sp-lint` | 代码规范 | 多项目代码规范检查 |
| `sp-python-lint` | Python 规范 | Python 代码规范检查 |
| `sp-typecheck` | 类型检查 | TypeScript 类型检查 |
| `sp-prisma` | Prisma ORM | Prisma ORM 操作 |
| `sp-deploy-check` | 部署检查 | 部署前综合检查 |

#### 环境与配置 (2 个)

| Skill | 名称 | 说明 |
|-------|------|------|
| `sp-python-setup` | Python 环境 | Python 环境安装配置 |
| `sp-cf-deploy` | CF 部署 | Cloudflare Pages 部署 |

#### 飞书自动化 (9 个)

| Skill | 名称 | 说明 |
|-------|------|------|
| `sp-feishu-login` | 飞书登录 | 飞书会话登录，保存 Playwright session |
| `sp-feishu-doc` | 飞书文档 | 飞书文档创建和读取 |
| `sp-feishu-wiki-doc` | Wiki 文档 | 在飞书 Wiki 中创建子页面（支持去重管理） |
| `sp-feishu-prd` | PRD 文档 | 生成 PRD 产品需求文档并可选推送到飞书 |
| `sp-feishu-weekly` | 周报/月报 | 生成周报/月报文档 |
| `sp-feishu-member-weekly` | 成员周报 | 汇总成员个人周报 |
| `sp-feishu-project-board` | 项目看板 | 创建飞书项目空间（文档+多维表格+甘特图） |
| `sp-feishu-bitable` | 多维表格 | 飞书多维表格操作（创建/更新/查询） |
| `sp-feishu-notify` | 飞书通知 | 通过飞书 Webhook 发送通知 |

---

## 四、飞书自动化流程图

```mermaid
flowchart TB
    Login["sp-feishu-login<br/>Playwright 会话登录"]
    
    subgraph 文档类
        Doc["sp-feishu-doc<br/>文档创建/读取"]
        Wiki["sp-feishu-wiki-doc<br/>Wiki 子页面"]
        PRD["sp-feishu-prd<br/>PRD 需求文档"]
    end

    subgraph 报表类
        Weekly["sp-feishu-weekly<br/>周报/月报"]
        Member["sp-feishu-member-weekly<br/>成员周报汇总"]
    end

    subgraph 项目管理
        Board["sp-feishu-project-board<br/>项目空间初始化"]
        Bitable["sp-feishu-bitable<br/>多维表格操作"]
    end

    Notify["sp-feishu-notify<br/>Webhook 通知"]

    Login -->|"认证前置"| Doc
    Login -->|"认证前置"| Wiki
    Login -->|"认证前置"| PRD
    Login -->|"认证前置"| Weekly
    Login -->|"认证前置"| Member
    Login -->|"认证前置"| Board
    Login -->|"认证前置"| Bitable
    
    Board --> Bitable
    Board --> Doc

    Weekly --> Notify
    Member --> Notify
    PRD --> Doc

    subgraph 底层库["scripts/lib/feishu/"]
        BM["browser-manager.mjs"]
        SEL["selectors.mjs"]
        PAGES["pages/"]
        GANTT["gantt.mjs"]
        MILE["milestone.mjs"]
        NOTIF["notify.mjs"]
        DREG["doc-registry.mjs"]
        PREG["project-registry.mjs"]
    end
```

### 飞书依赖

- `playwright ^1.50.0` — 浏览器自动化
- `marked ^15.0.0` — Markdown 解析
- `turndown ^7.0.0` — HTML 转 Markdown
- 认证数据: `<workspace>/auth/`
- 项目注册: `<workspace>/config/projects.json`
- 配置模板: `config/feishu-config.example.json`

---

## 五、标准工作流

```mermaid
flowchart TB
    REQ["用户需求"]
    
    REQ --> AUTO{"auto 模式<br/>自动判定通道"}
    
    AUTO -->|"紧急/hotfix"| HOTFIX["紧急通道<br/>PM → Coder + Tester<br/>跳过设计和审查"]
    AUTO -->|"≤1 文件"| EXPRESS["直通通道<br/>PM → Coder<br/>跳过 TeamLead"]
    AUTO -->|"≤3 文件"| SIMPLE["快速通道<br/>TeamLead + Coder + Tester<br/>跳过 Architect"]
    AUTO -->|"≤10 文件"| STANDARD["标准通道<br/>全角色参与"]
    AUTO -->|">10 文件/跨模块"| FULL["完整通道<br/>双 Architect + 多 Coder"]
    AUTO -->|"探索/spike"| SPIKE["探索通道<br/>Architect(haiku) + Coder<br/>spike 分支"]

    STANDARD --> P1["Phase 1: 设计<br/>Architect 出方案"]
    P1 --> P2["Phase 2: 实现<br/>Coder 并行 + Tester 同步"]
    P2 --> P3["Phase 3: 代码审查<br/>Reviewer 审查"]
    P3 -->|"不通过"| P2
    P3 -->|"通过"| GATE["Phase 3.5: 验收质量关"]
    
    subgraph GATE_DETAIL["验收 4 道门禁"]
        G1["Gate 1: 构建验证<br/>编译零错误"]
        G2["Gate 2: 测试验证<br/>全量测试零失败"]
        G3["Gate 3: 运行验证<br/>服务可启动"]
        G4["Gate 4: 回归验证<br/>下游项目通过"]
    end

    GATE --> GATE_DETAIL
    GATE_DETAIL -->|"REJECTED"| P2
    GATE_DETAIL -->|"ACCEPTED"| P4["Phase 4: 收尾<br/>更新记忆·释放团队·汇报"]
    P4 --> DEPLOY["Phase 5: 部署 (用户触发)"]
```

---

## 六、升级决策树

```mermaid
flowchart TB
    ISSUE["遇到问题/不确定"]
    
    ISSUE --> L0{"角色内能自决?"}
    L0 -->|"是"| L0A["L0: 角色内自决<br/>Coder 选实现方式<br/>Tester 选测试框架"]
    
    L0 -->|"否"| L1{"技术不确定?"}
    L1 -->|"是"| L1A["L1: 上报 Architect<br/>接口修改·设计歧义<br/>Lite 模式直接上报 PM"]
    
    L1 -->|"否"| L2{"角色间分歧?"}
    L2 -->|"是"| L2A["L2: 上报 TeamLead<br/>方案分歧·Reviewer 否决<br/>Agent 异常处理"]
    
    L2 -->|"否"| L3{"超出项目范围?"}
    L3 -->|"是"| L3A["L3: 上报 Group-Lead / PM<br/>涉及其他项目·资源不足<br/>架构级风险"]
    
    L3 -->|"否"| L4["L4: 上报用户 (必须审批)<br/>数据库变更·治理文件修改<br/>跨组契约变更·不可逆操作"]
```

---

## 七、Hook 拦截链

```mermaid
flowchart LR
    subgraph UserPromptSubmit
        H1["sp-bootstrap-guard.mjs<br/>会话启动时引导检查<br/>portfolio.json 存在性·完整性"]
    end

    subgraph PreToolUse["PreToolUse 拦截"]
        H2["sp-pm-allowlist-guard.mjs<br/>matcher: *<br/>PM 工具 allowlist 物理约束<br/>fail-closed 模型"]
        H3["sp-route-guard.mjs<br/>matcher: Agent<br/>SP-ROLE 标记校验<br/>Agent 派发合法性"]
        H4["sp-destructive-guard.mjs<br/>matcher: Bash<br/>破坏性命令拦截<br/>重定向/管道写入阻止"]
    end

    UserInput["用户输入"] --> H1
    H1 --> ToolCall["工具调用"]
    ToolCall --> H2
    H2 --> H3
    H2 --> H4
```

### Hook 详情

| Hook | 触发时机 | Matcher | 功能 |
|------|----------|---------|------|
| `sp-bootstrap-guard` | UserPromptSubmit | `*` | 会话启动引导检查，验证 portfolio.json |
| `sp-pm-allowlist-guard` | PreToolUse | `*` | PM 工具白名单物理约束，fail-closed 模型，子 agent 自动豁免 |
| `sp-route-guard` | PreToolUse | `Agent` | 校验 `[SP-ROLE:xxx]` 标记与 Agent 类型匹配 |
| `sp-destructive-guard` | PreToolUse | `Bash` | 拦截破坏性命令，禁止重定向写入 (`>`, `>>`, `tee`, `sed -i`) |

---

## 八、违规检测与处理

```mermaid
flowchart TB
    OP["Agent 即将执行操作"]
    OP --> CHECK{"操作在权限白名单内?"}
    
    CHECK -->|"是"| EXEC["正常执行"]
    CHECK -->|"否"| STOP["立即停止"]
    
    STOP --> DECLARE["输出违规声明"]
    DECLARE --> CLASSIFY{"违规级别"}
    
    CLASSIFY -->|"V1 轻微"| V1["Agent 自行声明<br/>继续工作<br/>如: Coder 修改注释格式"]
    CLASSIFY -->|"V2 一般"| V2["上报 TeamLead 裁决<br/>如: 跨模块修改"]
    CLASSIFY -->|"V3 严重"| V3["上报 PM → 用户报告<br/>如: 越界写入·跨项目操作"]
    CLASSIFY -->|"V4 关键"| V4["必须用户审批<br/>如: PM 写非管理路径·修改治理文件"]
```

---

## 九、Agent 预算与并行模型

```mermaid
flowchart TB
    TOTAL["总预算: 20 个 Agent"]
    
    TOTAL --> FIXED["固定开销"]
    TOTAL --> PROJECT["项目可用预算"]
    
    FIXED --> PM_A["PM: 1 (常驻)"]
    FIXED --> GL_A["Group-Lead: 1/活跃组 (最多 2)"]
    FIXED --> CROSS["Cross-Arch/Rev: 0~2 (仅跨组时)"]
    
    PROJECT --> MIN["最小配置 (直通/快速)<br/>1~2 Agent"]
    PROJECT --> STD["标准配置<br/>3~4 Agent"]
    PROJECT --> FULL_A["完整配置<br/>5~8 Agent"]
    
    subgraph 并行规则
        R1["每项目最多 3 个并行需求"]
        R2["每需求独立 Git 分支"]
        R3["Reviewer 项目内共享"]
        R4["预算不足时分批执行"]
    end
```

---

## 十、OMC 执行模式整合

| 任务特征 | OMC 模式 | 组合方式 |
|----------|----------|----------|
| ≥3 独立子任务需并行 | `/ultrawork` | ultrawork 内部派发 sp-governance agents |
| 迭代直到完成 | `/ralph` | ralph 驱动 sp-coder → sp-tester 循环 |
| 端到端自主执行 | `/autopilot` | autopilot 全流程使用 sp-governance agents |
| 需求模糊需先澄清 | `/ralplan` `/deep-interview` | 先澄清再用 SP agents 执行 |
| 复杂 bug 定位 | `/trace` | tracer 定位 → sp-coder 修复 |
| N 个协作 agent 流水线 | `/team` | team pipeline 内使用 sp-governance agents |
| 多模型交叉验证 | `/ccg` | Claude+Codex+Gemini 分析 → SP agent 执行 |
| QA 循环验证 | `/ultraqa` | ultraqa 驱动 sp-tester 反复验证 |

---

## 十一、目录结构速览

```
sp-governance/
├── CLAUDE.md                   # 权威规则源 (PM 身份·核心规则·Agent 规范)
├── agents/                     # 9 个 Agent 定义
│   ├── sp-architect.md
│   ├── sp-coder.md
│   ├── sp-cross-architect.md
│   ├── sp-cross-reviewer.md
│   ├── sp-doc-engineer.md
│   ├── sp-group-lead.md
│   ├── sp-reviewer.md
│   ├── sp-team-lead.md
│   └── sp-tester.md
├── governance/                 # 治理规则 (5 个文件)
│   ├── role-permissions.md
│   ├── workflow-rules.md
│   ├── escalation-rules.md
│   ├── violation-protocol.md
│   └── health-monitoring.md
├── hooks/
│   └── hooks.json              # 4 个 Hook 定义
├── skills/                     # 39 个 Skill
│   ├── sp-bootstrap/           ... sp-vitest/
├── scripts/
│   ├── feishu/                 # 9 个飞书入口脚本
│   ├── lib/feishu/             # 飞书共享库
│   ├── sp-bootstrap-guard.mjs
│   ├── sp-pm-allowlist-guard.mjs
│   ├── sp-route-guard.mjs
│   └── sp-destructive-guard.mjs
├── templates/                  # 项目模板
│   ├── feishu/                 # 飞书文档模板
│   ├── bitable/                # 多维表格模板
│   ├── code/                   # 代码模板
│   └── *.template              # 配置模板
└── docs/
    └── sp-capability-map.md    # 本文档
```
