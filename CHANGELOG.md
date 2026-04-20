# Changelog

## [9.0.0-rc.1] - 2026-04-20

### Breaking Changes
- 废弃所有 `sp-governance:sp-*` agents，统一使用 OMC agents (oh-my-claudecode:*)
- 引入三层架构（SP 治理层 / OMC 执行层 / ECC 质量层）
- 集成状态结构变更（.sp/integration.json schema 重新定义）

### Added
- `scripts/adapters/` 适配层（omc-adapter, ecc-adapter, ecc-learning-bridge）
- `scripts/lib/integration.mjs` 集成状态核心库
- 5 个新 skill: sp-install-ecc, sp-install-omc, sp-integration-check, sp-learning-status, sp-upgrade-check
- `docs/three-layer-architecture.md` 三层架构文档
- MIGRATION.md 迁移指南

### Changed
- bootstrap-guard 支持 OMC/ECC 探测和运行模式判断
- route-guard 支持 ECC 规则上下文注入和 OMC agent 推荐
- ECC 最低兼容版本设为 1.8.0

### Fixed
- integration.mjs 输出结构与 schema.json 对齐
- techStack vs tech_stack 字段统一
- refreshIntegrationState async 误用修复
- writeIntegrationState 增加 workspaceRoot 校验

## [8.0.0] - 2026-04-14
- 轻量双角色模型（PM + Team-Lead）
- 完整卸载支持 (sp-uninstall skill)
- Bootstrap Guard 静默初始化

## [7.x] 及更早
- 完整 PM 角色模型
- 9 个 SP agents
- 违规检测 V1-V4
