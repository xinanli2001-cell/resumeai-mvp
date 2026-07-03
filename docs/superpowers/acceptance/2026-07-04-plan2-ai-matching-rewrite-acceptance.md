# Plan 2 验收标准：Resume SaaS AI Matching and Rewrite

日期：2026-07-04  
对应计划：`docs/superpowers/plans/2026-07-04-resume-saas-ai-matching-rewrite.md`  
验收对象：`web/` 应用中新增的 LLM 层、JD 解析、经历推荐、STAR 改写确认闭环  
前置条件：Plan 1 已完成并可通过全部自动化检查

## 1. 验收结论标准

Plan 2 只有在以下条件全部满足时才算完成：

- 用户可以粘贴自由文本，系统调用 LLM 拆解为结构化经历草稿。
- 拆解草稿可编辑，未确认前不写入正式信息库。
- 无法确定的字段被标记为「待确认」，不被伪造。
- 用户可以输入 JD，系统解析出职责、技能、关键词和语言。
- 系统从信息库中推荐匹配经历，推荐项高亮并给出可解释的匹配理由。
- 非推荐经历仍可被用户手动选择。
- 只有用户最终选择的经历进入改写阶段。
- 系统按完整经历块进行 STAR 改写，不以单条 bullet 为最小确认单位。
- 默认模式不直接新增未经确认的事实；不确定项进入待确认列表。
- 包装模式是独立开关，默认关闭，开启前有真实性提示。
- 改写支持中文、英文、双语输出。
- 改写结果确认页展示原文、改写、匹配理由、待确认项，并支持确认 / 编辑 / 拒绝。
- 用户至少确认一段经历后才能进入下一步（简历编辑，属 Plan 3）。
- 每次 LLM 调用都消耗额度并写入用量记录；管理员不受额度限制。
- LLM provider 可替换：测试与无 key 环境使用 mock，不产生网络调用。
- 自动化检查全部通过。
- 端到端 smoke flow 可从自由文本导入跑到改写确认。

## 2. 明确不验收的范围

以下内容不属于 Plan 2，不能因为缺失而判定 Plan 2 失败：

- 简历编辑器（左信息库 / 右简历）。
- 模板自定义与「我的模板」。
- PDF 导出。
- 部署、备份、监控、隐私删除工作流（Plan 4）。
- 支付订阅。
- Word/PDF 模板上传识别。
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

- `pnpm test` 退出码为 0，且包含新增单测：`llm-mock`、`import-service`、`match-service`、`rewrite-service`。
- `pnpm typecheck` 退出码为 0。
- `pnpm build` 退出码为 0。
- `pnpm test:e2e` 退出码为 0，且包含 `ai-flow.spec.ts`。

任一命令失败，Plan 2 不算完成。测试运行期间不得发起任何真实 LLM 网络请求。

## 4. 本地环境验收

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
cp .env.example .env
pnpm install
pnpm db:generate
rm -f prisma/dev.db
pnpm db:migrate --name plan2_ai_matching_rewrite
pnpm db:seed
pnpm dev
```

通过标准：

- `.env.example` 含 `LLM_PROVIDER`、`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 四个变量，均有安全默认。
- 未配置 `DEEPSEEK_API_KEY` 时，应用以 mock provider 正常运行，不报网络错误。
- 迁移后数据库同时包含 Plan 1 与 Plan 2 全部表。
- seed 不报错。

## 5. LLM Provider 验收

通过标准：

- 存在 `LLMProvider` 接口，至少含 `extractStructuredExperience`、`parseJobDescription`、`rewriteExperience` 三个方法。
- 存在 DeepSeek 实现，走 OpenAI 兼容 `POST {DEEPSEEK_BASE_URL}/chat/completions`，`model` 取自 `DEEPSEEK_MODEL`，强制 JSON 输出，并用 Zod 校验响应。
- 存在 mock 实现，纯确定性、无网络、无随机、无时钟依赖。
- `createProvider()` 仅在 `LLM_PROVIDER === "deepseek"` 且 `DEEPSEEK_API_KEY` 非空时返回 DeepSeek，否则返回 mock。
- mock provider 对相同输入返回相同输出（单测覆盖）。

## 6. 自由文本导入与 AI 拆解验收

步骤：

1. 登录普通用户，进入 `/library`。
2. 使用「粘贴文本导入」，粘贴一段经历文本，点击「AI 拆解」。
3. 查看拆解草稿。
4. 编辑其中字段。
5. 确认保存一段经历。
6. 刷新页面。

通过标准：

- 拆解结果以可编辑表单呈现。
- 无法确定的字段显示为「待确认」，未被填入虚假内容。
- 在用户点击保存前，信息库中不出现该经历（`import-service` 单测断言数据库计数不变）。
- 用户确认后，经历通过既有 `POST /api/experiences` 写入并在刷新后仍存在。
- 用户可以放弃本次导入，不产生任何写入。
- 导入拆解消耗 1 额度并记录 `actionType = import`。

## 7. JD 解析与经历推荐验收

步骤：

1. 进入 `/match`。
2. 粘贴一段 JD，触发解析并匹配。
3. 查看解析出的关键词 / 技能。
4. 查看推荐经历高亮与匹配理由。
5. 取消一个推荐项，勾选一个非推荐项。
6. 触发生成改写。

通过标准：

- JD 解析结果包含 requirements、skills、keywords、language 并持久化为 `JobDescription`。
- 推荐排序由确定性算法产生：与 JD 技能/关键词重合越多，排序越靠前（`match-service` 单测覆盖）。
- 每个推荐项显示至少一个具体命中的技能或关键词作为匹配理由。
- 非推荐经历仍出现在列表中且可被手动选择。
- 只有用户最终勾选的经历进入改写。
- 匹配阶段不消耗额度、不调用 LLM。
- JD 解析消耗 1 额度并记录 `actionType = jd_parse`。

## 8. STAR 改写与确认页验收

改写确认页（`/rewrite/[id]`）必须展示：

- 当前 JD 摘要。
- 用户已选择的每段经历块。
- 每段经历的匹配理由。
- 原始内容（快照）。
- STAR 改写结果。
- 待确认补全项。
- 包装模式状态。
- 确认 / 编辑 / 拒绝操作。

通过标准：

- 改写和确认的最小单位是完整经历块，不是单条 bullet。
- 默认模式下，不确定内容进入待确认项，不直接作为事实写入改写文本。
- 包装模式默认关闭，开启前展示真实性提示。
- 每段经历可输出中文、英文或双语。
- 用户确认（ACCEPTED）、编辑（EDITED，保存 `userEditedText`）、拒绝（REJECTED）状态正确落库。
- 被拒绝的经历不进入后续简历（不满足进入条件）。
- 页面能区分「AI 原始建议」与「用户确认版本」。
- 至少确认一段经历后，「进入简历编辑」按钮才可用；否则禁用。
- 每段经历的改写消耗 1 额度并记录 `actionType = rewrite`；`relatedObjectId` 指向对应改写记录。

## 9. 额度与用量验收

通过标准：

- import、jd_parse、rewrite 每个动作各消耗 1 额度。
- 普通用户额度不足时，改写在生成前被整体拒绝（不生成、不扣费），页面提示额度不足（HTTP 402 / `Quota exceeded`）。
- LLM 调用失败时记录 `status = FAILED` 且不扣额度。
- 管理员不受额度限制。
- 后台（Plan 1 的 `/admin`）能看到新增的 `import` / `jd_parse` / `rewrite` 用量记录。

## 10. 数据模型验收

Prisma schema 在 Plan 1 基础上至少新增：

- 模型：`JobDescription`、`RewriteSession`、`RewrittenExperience`。
- 枚举：`RewriteMode`、`LanguageMode`、`RewriteSessionStatus`、`RewriteDecision`。

通过标准：

- `JobDescription` 绑定 `userId`，保存 rawText 与解析结果。
- `RewriteSession` 绑定 `userId` 与 `jdId`，记录 `selectedExperienceIds`、`mode`、`languageMode`、`status`。
- `RewrittenExperience` 绑定 `sessionId`，保存 `originalSnapshot`、`rewrittenText`、`matchReason`、`pendingClaims`、`userEditedText`、`decision`。
- `RewrittenExperience.sourceExperienceId` 可空且为 `SetNull`：删除源经历时保留改写快照，不破坏历史。
- 删除用户级联清理其 JD / session / 改写记录。

## 11. 端到端 Smoke Flow

必须能完成以下路径（mock provider，离线确定性）：

1. 新用户注册并登录。
2. 在信息库粘贴文本导入并确认保存一段经历。
3. 输入 JD 并解析。
4. 看到推荐经历高亮与匹配理由。
5. 选择经历、选择语言、生成改写。
6. 在改写确认页确认至少一段经历。
7. 拒绝另一段经历。
8. 验证「进入简历编辑」按钮在确认后可用。

通过标准：

- 全流程不出现 500 错误。
- 用户输入在正常保存后不丢失。
- 权限边界符合预期（用户只能访问自己的 JD / session / 改写记录）。
- 全流程不产生真实 LLM 网络请求。

## 12. 交付物验收

Plan 2 完成时应新增存在：

- `src/lib/llm/`（types、mock、deepseek、provider）。
- `src/lib/import/`、`src/lib/jd/`、`src/lib/match/`、`src/lib/rewrite/` 服务。
- `src/app/api/import`、`src/app/api/jd`、`src/app/api/match`、`src/app/api/rewrite`（含 `[id]`）路由。
- `/match` 与 `/rewrite/[id]` 页面及其 client 组件；信息库导入入口。
- 新增单测：`llm-mock`、`import-service`、`match-service`、`rewrite-service`。
- 端到端测试：`ai-flow.spec.ts`。
- 更新后的 `prisma/schema.prisma`、migration、`.env.example`、README。

## 13. 失败判定

出现任一情况即视为未通过：

- 拆解或改写在用户确认前就写入正式信息库/简历。
- 无法确定的信息被伪造为事实，而非标记待确认。
- 推荐不给出可解释理由，或非推荐经历无法被手动选择。
- 改写以单条 bullet 而非完整经历块为确认单位。
- 包装模式默认开启，或开启前无真实性提示。
- 未确认任何经历也能进入下一步。
- LLM 调用不计额度，或普通用户超额仍能生成。
- 管理员被额度限制。
- 测试运行期间发起真实 LLM 网络请求，或测试依赖真实 API key。
- 普通用户能访问他人 JD / session / 改写记录。
- 自动化检查失败。
- 实现了简历编辑器、模板、PDF 导出或评分入口（越界到后续计划）。
