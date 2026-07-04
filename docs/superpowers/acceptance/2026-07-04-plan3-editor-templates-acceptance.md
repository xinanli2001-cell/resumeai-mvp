# Plan 3 验收标准：Resume SaaS Editor and Templates

日期：2026-07-04  
对应计划：`docs/superpowers/plans/2026-07-04-resume-saas-editor-templates.md`  
验收对象：`web/` 应用中新增的简历编辑器、模板系统、Plan 2→3 打通  
前置条件：Plan 1、Plan 2 已完成并可通过全部自动化检查

## 1. 验收结论标准

Plan 3 只有在以下条件全部满足时才算完成：

- 用户可从已确认的改写 session 生成一份简历。
- 只有 ACCEPTED / EDITED 的经历块进入简历；PENDING / REJECTED 不进入。
- EDITED 块使用 `userEditedText`，ACCEPTED 块使用 `rewrittenText`。
- 简历编辑页为左右结构：左侧个人信息库（参考），右侧简历编辑 / 预览。
- 用户能调整模块顺序。
- 用户能显示 / 隐藏模块。
- 用户能内联编辑简历文字。
- 提供 2 套系统模板，用户能在简历上切换模板。
- 用户能在平台内自定义模板（模块顺序、字体、字号、间距、颜色、标题样式、页眉样式）。
- 用户能把自定义保存为「我的模板」并在其他简历复用。
- 切换 / 自定义模板不改变简历文字内容（`contentSnapshot` 不被模板改写）。
- 简历内容为快照：后续修改信息库或改写 session 不会回改已保存简历。
- 双语通过 `Resume.language`（zh/en/bilingual）承载，文本来自改写阶段。
- 用户能保存简历版本，刷新后内容仍在。
- 改写确认页「进入简历编辑」在确认 ≥1 段后可用，点击后生成简历并跳转到编辑页。
- 本计划不产生任何 LLM 调用、不消耗额度。
- 自动化检查全部通过。
- 端到端 smoke flow 可从改写 session 跑到简历编辑并持久化。

## 2. 明确不验收的范围

以下内容不属于 Plan 3，不能因为缺失而判定 Plan 3 失败：

- **PDF 导出**（产品决策明确延后，不在本计划）。不得因无 PDF 导出而判失败；反之，若实现了 PDF 导出/打印路由/PDF 依赖，视为越界。
- 部署、备份、监控、隐私删除工作流（Plan 4）。
- 支付订阅、模板市场、Word/PDF 模板上传识别。
- 简历评分。项目已明确不做评分入口。

## 3. 自动化验收命令

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

通过标准：

- `pnpm test` 退出码为 0，且包含新增单测：`resume-service`、`template-service`。
- `pnpm typecheck` 退出码为 0。
- `pnpm build` 退出码为 0，且包含 `/resumes`、`/resume/[id]` 路由。
- `pnpm test:e2e` 退出码为 0，且包含 `resume-flow.spec.ts`。

任一命令失败，Plan 3 不算完成。测试期间不得发起任何网络 LLM 请求。

## 4. 本地环境验收

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
cp .env.example .env
pnpm install
pnpm db:generate
rm -f prisma/dev.db
pnpm db:migrate --name plan3_editor_templates
pnpm db:seed
pnpm dev
```

通过标准：

- 迁移后数据库同时包含 Plan 1 / 2 / 3 全部表。
- seed 后存在 2 套系统模板（`isSystem = true`，`ownerUserId = null`）。
- 应用以 mock provider 正常运行，不报网络错误。

## 5. 数据模型验收

Prisma schema 在 Plan 1/2 基础上至少新增：

- 模型：`Resume`、`Template`。
- 枚举：`ResumeStatus`。

通过标准：

- `Template` 支持系统模板（`isSystem = true`、`ownerUserId = null`）与用户模板（`ownerUserId` 指向用户）。
- `Template.config` 存储模板表现配置，通过 `TemplateConfigSchema` 校验。
- `Resume` 绑定 `userId`，含 `language`、`templateId`、`contentSnapshot`、`status`。
- `Resume.contentSnapshot` 通过 `ResumeContentSchema` 校验。
- `Resume.sessionId` 可空且为 `SetNull`：删除来源 session 时保留简历。
- 删除用户级联清理其模板与简历。

## 6. 从 Session 生成简历验收

步骤：

1. 完成 Plan 2 流程到一个已确认 ≥1 段的 session。
2. 在改写确认页点击「进入简历编辑」。
3. 进入 `/resume/[id]`。

通过标准：

- 未确认任何经历时按钮禁用；确认 ≥1 段后可用。
- 生成的简历只包含 ACCEPTED / EDITED 块。
- EDITED 块文字为 `userEditedText`，ACCEPTED 块文字为 `rewrittenText`（`resume-service` 单测覆盖）。
- 每个简历条目保留 `sourceRewrittenId` 溯源。
- 简历 header 从个人信息库 Profile 填充。
- 生成简历不消耗额度、不调用 LLM。

## 7. 简历编辑器验收

编辑页 `/resume/[id]` 必须为左右结构：

- 左侧：个人信息库（基本信息、联系方式、教育、项目、实习、工作、职业能力），只读参考。
- 右侧：简历编辑 / 预览。

通过标准：

- 用户能调整模块（section）顺序。
- 用户能显示 / 隐藏模块。
- 用户能内联编辑条目文字与模块标题。
- 编辑器不会修改个人信息库原始数据。
- 用户能保存简历（`PATCH /api/resumes/[id]`）。
- 刷新页面后，排序 / 显隐 / 文字修改仍保留。

## 8. 模板系统验收

通过标准：

- 至少 2 套系统模板可选。
- 用户能在简历上切换模板，预览样式随之变化。
- 切换模板不改变 `contentSnapshot`（文字内容不变，`resume-service` 单测覆盖）。
- 用户能自定义模板配置：模块顺序、字体、字号、间距、颜色、标题样式、页眉样式。
- 用户能「保存为我的模板」，生成 `isSystem = false`、`ownerUserId = 当前用户` 的模板。
- `listTemplates` 返回系统模板 + 当前用户模板，不返回他人模板（`template-service` 单测覆盖）。
- 用户能在不同简历版本复用自己保存的模板。

## 9. 双语验收

通过标准：

- `Resume.language` 支持 `zh` / `en` / `bilingual`。
- 简历文字来自改写阶段对应语言输出（Plan 2 的 `languageMode`）。
- 语言不同的简历版本能各自独立保存与展示。

## 10. 端到端 Smoke Flow

必须能完成以下路径（mock provider，离线确定性）：

1. 新用户注册并登录。
2. 导入并确认一段经历到信息库。
3. 输入 JD、生成改写、确认 ≥1 段。
4. 点击「进入简历编辑」跳转到 `/resume/[id]`。
5. 调整模块顺序、隐藏一个模块、编辑一条文字、切换模板、保存。
6. 刷新编辑页，上述修改仍在。

通过标准：

- 全流程不出现 500 错误。
- 用户输入在正常保存后不丢失。
- 权限边界符合预期（用户只能访问自己的简历与模板）。
- 全流程无真实 LLM 网络请求，无 PDF 导出动作（本计划不实现）。

## 11. 交付物验收

Plan 3 完成时应新增存在：

- `src/lib/resume/`（`resume-content.ts`、`resume-service.ts`）。
- `src/lib/template/`（`template-config.ts`、`template-service.ts`）。
- `src/app/api/resumes`（含 `[id]`）、`src/app/api/templates` 路由。
- `/resumes` 列表页与 `/resume/[id]` 编辑页及 client 组件。
- 新增单测：`resume-service`、`template-service`。
- 端到端测试：`resume-flow.spec.ts`。
- 更新后的 `prisma/schema.prisma`、migration、`seed.ts`（含 2 套系统模板）、README。

## 12. 失败判定

出现任一情况即视为未通过：

- 简历包含未确认（PENDING/REJECTED）的经历块。
- EDITED 块未使用用户编辑文本。
- 切换或自定义模板改变了简历文字内容。
- 后续修改信息库或改写 session 回改了已保存简历（快照被污染）。
- 用户无法调整模块顺序或显隐。
- 无法保存为「我的模板」，或用户能看到他人模板。
- 未确认任何经历也能进入简历编辑。
- 简历编辑器修改了信息库原始数据。
- 普通用户能访问他人简历或模板。
- 本计划产生了 LLM 调用或消耗了额度。
- 实现了 PDF 导出 / 打印路由 / PDF 依赖（越界）。
- 实现了评分入口。
- 自动化检查失败，或测试期间发起真实 LLM 网络请求。
