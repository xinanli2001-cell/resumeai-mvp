# Agent Handoff：AI 简历修改工具

日期：2026-07-03（2026-07-04 更新）  
工作目录：`/Users/lixinan/Desktop/简历修改工具`  
当前状态：**Plan 1（MVP Foundation）已实现完成并通过验收**；Plan 2（AI Matching and Rewrite）计划与验收标准已写好，待执行。  
仓库状态：已是 git 仓库；`web/` 应用已存在。

## 0. 最新进度（2026-07-04）

- **Plan 1 已完成**：`web/` Next.js 应用、auth、个人信息库、额度/用量、最小后台，全部实现并有测试覆盖。
- **Plan 2 已完成并通过验收**（分支 `plan2-ai-matching-rewrite`）：LLM provider（DeepSeek + mock）、自由文本导入拆解、JD 解析、确定性推荐、STAR 改写确认。验收结果：`pnpm test` 21 passed / `typecheck` / `build` / `test:e2e` 全绿，关键正确性/安全项逐条通过。
- **Plan 3 已完成并通过验收**（分支 `plan3-editor-templates`）：简历编辑器、2 套系统模板、模板自定义 + 我的模板、双语、Plan 2→3 打通。验收结果：`pnpm test` 28 passed / `typecheck` / `build` / `test:e2e`（含 `resume-flow`）全绿；模板切换不改内容、快照隔离、删除保护逐条通过；全库无 PDF/print 越界。
- **Plan 4 文档已就绪**，可直接交给 Codex 开工：
  - 计划：`docs/superpowers/plans/2026-07-04-resume-saas-deployment-hardening.md`
  - 验收：`docs/superpowers/acceptance/2026-07-04-plan4-deployment-hardening-acceptance.md`
  - 范围：fail-fast 配置、安全头/限流/输入限制、隐私删除、脱敏日志+健康检查+失败韧性、Postgres 生产路径、备份、发布检查。**PDF 明确不做**（已作为延后项记录在计划末尾，需产品另行拍板）。
  - 执行入口：新建分支 `plan4-deployment-hardening`，按 Task 1→7 顺序实现。
- Plan 3 文档：
  - 计划：`docs/superpowers/plans/2026-07-04-resume-saas-editor-templates.md`
  - 验收：`docs/superpowers/acceptance/2026-07-04-plan3-editor-templates-acceptance.md`
- Plan 3 技术基线（已与用户确认）：
  - 简历编辑器（左信息库 / 右编辑预览）+ 模块排序/显隐 + 内联编辑。
  - 系统模板 2 套 + 平台内模板自定义 + 「我的模板」保存复用。
  - 双语 = 一份 `Resume` + `language` 字段（zh/en/bilingual），文本来自 Plan 2 改写输出。
  - `Resume.contentSnapshot` 为快照，模板切换只改表现不改内容。
  - 打通 Plan 2→3：改写确认页「进入简历编辑」从 session 生成 Resume 并跳转。
  - **PDF 导出：产品决策明确延后，不在 Plan 3。** 不做打印路由/PDF 依赖；若实现 PDF 视为越界失败。
- 执行入口：在 `web/` 新建分支 `plan3-editor-templates`，按计划 Task 1→6 顺序实现，每个 Task 跑验证并提交。
- Plan 2 技术基线（已落地，供 Plan 3 复用）：
  - LLM Provider = **DeepSeek**（`deepseek-chat`，OpenAI 兼容，走 `fetch`，无新依赖）+ 可注入 **mock** provider（测试/无 key 用，零网络）。
  - 额度计费 = 每个 LLM 动作 1 unit（import / jd_parse / 每段 rewrite 各 1），复用 `assertCanConsume` / `recordUsage`；匹配阶段不扣额度。
  - 经历推荐 = **确定性**关键词/技能重合打分（不调用 LLM），理由可解释、可单测。
  - 已确认经历块规则：ACCEPTED → `rewrittenText`，EDITED → `userEditedText`，PENDING/REJECTED 排除。
- 两个持续生效的工程约束（各计划均已写明处理方式）：
  1. 单测跑真实 `dev.db` 单例 + `deleteMany` 清理，`fileParallelism:false`；LLM 测试必须用 mock provider。
  2. `scripts/sqlite-migrate.ts` 只初始化全新库；加新表需 `rm -f prisma/dev.db` 后重建 + 重新 seed。

## 1. 必读文件

按顺序阅读：

1. `docs/superpowers/specs/2026-07-03-resume-rewrite-saas-prd.md`
2. `docs/superpowers/plans/2026-07-03-resume-saas-mvp-foundation.md`
3. `docs/superpowers/acceptance/2026-07-03-plan1-foundation-acceptance.md`
4. `docs/superpowers/prompts/2026-07-03-google-stitch-prototype-prompt.md`

## 2. 产品决策摘要

- 产品是面向留学生/应届生的 AI 简历修改 SaaS。
- 首版采用 SaaS 雏形，而不是本地个人工具。
- 核心流程：个人信息库 -> 输入 JD -> AI 推荐经历 -> 用户选择经历 -> 按完整经历块改写 -> 用户确认 -> 简历编辑 -> 导出。
- 改写确认的最小单位是完整经历块，不是 bullet point。
- 个人信息库必须包含基本信息、联系方式、求职属性、教育、项目、实习、工作、职业能力。
- JD 匹配模式是“系统推荐并高亮，用户最终选择，也可选择非推荐项”。
- 默认改写模式允许合理补全，但不确定内容必须标记待确认。
- 包装模式是单独开关，默认关闭，开启前需要真实性提示。
- 支持中文、英文、双语输出。
- 简历编辑页目标是接近 WonderCV 的完整编辑器，但 MVP 需要控制范围。
- 用户自有模板首版采用平台内模板编辑器自定义，不做 Word/PDF 上传识别。
- 不做简历评分。不要加入评分入口。
- 普通用户有免费额度和用量记录。
- 管理员账号无限使用。
- 管理员后台只做最小功能：用户列表、额度调整、管理员设置、生成记录。

## 3. 工程拆分

PRD 已拆成四个计划：

1. **Plan 1: MVP Foundation**  
   范围：Next.js scaffold、auth、数据库、个人信息库、额度、最小后台。

2. **Plan 2: AI Matching and Rewrite**  
   范围：LLM provider、自由文本拆解、JD 解析、经历推荐、STAR 改写确认。

3. **Plan 3: Resume Editor and Templates**  
   范围：左侧信息库/右侧简历编辑器、模板自定义、双语输出、PDF 导出。

4. **Plan 4: Deployment and Hardening**  
   范围：生产配置、备份、隐私删除、监控、发布检查。

不要在 Plan 1 完成前开始 Plan 2。

## 4. Plan 1 执行入口

执行 Plan 1：

```text
docs/superpowers/plans/2026-07-03-resume-saas-mvp-foundation.md
```

验收 Plan 1：

```text
docs/superpowers/acceptance/2026-07-03-plan1-foundation-acceptance.md
```

推荐执行方式：

- 使用 fresh agent / subagent 按 Task 1 到 Task 9 执行。
- 每个 Task 完成后运行该 Task 的验证命令。
- 每个 Task 完成后提交一次 commit。
- 如果当前目录仍不是 git 仓库，执行前先：

```bash
git init
git add docs
git commit -m "docs: add resume saas prd and foundation plan"
```

## 5. Plan 1 技术选择

计划中指定：

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite local dev
- Prisma schema 兼容后续 PostgreSQL 迁移思路
- Vitest
- Playwright
- Zod
- bcryptjs
- jose session JWT

如果执行 agent 想改技术栈，必须先说明原因并让用户确认。

## 6. Plan 1 完成标准

Plan 1 必须能通过：

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

并完成手工 smoke：

1. 新用户注册。
2. 新用户登录。
3. 新用户进入信息库。
4. 新用户填写基本信息和联系方式。
5. 新用户新增一个项目经历。
6. 刷新后数据仍存在。
7. 管理员登录。
8. 管理员进入后台。
9. 管理员看到新用户。
10. 管理员调整用户额度。

## 7. 当前未执行内容

当前只完成了文档和计划，没有执行以下内容：

- 没有创建 `web/` 应用。
- 没有安装依赖。
- 没有写业务代码。
- 没有初始化数据库。
- 没有运行测试。

## 8. 原型资源

Google Stitch 提示词已保存：

```text
docs/superpowers/prompts/2026-07-03-google-stitch-prototype-prompt.md
```

用途：

- 在工程实现前生成可点击原型。
- 验证页面流：信息库、JD 推荐、改写确认、简历编辑、模板设置、管理员后台。
- 原型不能替代工程验收。

## 9. 历史讨论资源

可视化 brainstorming 文件保存在：

```text
.superpowers/brainstorm/67867-1783084119/content/
```

其中重要文件：

- `resume-flow-layout.html`
- `prd-scope-flow.html`
- `prd-scope-flow-v2.html`
- `prd-scope-flow-v3.html`

这些只是讨论草图，不是产品代码。

## 10. 禁止误加范围

执行 agent 不要在 Plan 1 中加入：

- 简历评分。
- JD 推荐。
- LLM 调用。
- STAR 改写。
- 简历编辑器。
- PDF 导出。
- 支付订阅。
- Word/PDF 模板上传识别。

这些属于后续计划。

## 11. 给接手 agent 的第一条建议

先不要写代码。先读 PRD、Plan 1 和验收标准，然后确认本机是否有 `pnpm`、Node.js、网络访问和 git 仓库状态。确认后再从 Plan 1 Task 1 开始执行。
