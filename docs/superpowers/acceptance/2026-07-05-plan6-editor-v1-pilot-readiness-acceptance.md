# Plan 6 验收标准：Resume Editor V1 and Pilot Readiness

日期：2026-07-05
对应计划：`docs/superpowers/plans/2026-07-05-resume-editor-v1-pilot-readiness.md`
验收对象：`web/` 应用中的简历编辑器 V1 补强与试点准备
前置条件：Plan 1-5 已完成并可通过全部自动化检查

## 1. 验收结论标准

Plan 6 只有在以下条件全部满足时才算完成：

- 存在 Plan 6 design spec、implementation plan、acceptance doc。
- 用户可以在 `/resume/[id]` 从左侧个人信息库将经历加入当前简历。
- 加入经历只修改当前 `Resume.contentSnapshot`，不修改 `Experience` 原始数据。
- 同一条 library experience 不能被重复加入同一份简历。
- 若目标 section 不存在，系统会自动创建对应 section。
- 用户可以新增自定义模块。
- 用户可以删除当前简历 snapshot 中的模块。
- 用户可以给模块新增条目。
- 用户可以删除当前简历 snapshot 中的条目。
- 自定义模块和 library-added items 保存后刷新仍存在。
- 打印路由 `/resume/[id]/print` 能显示新增的 library-added 内容。
- 编辑器显示实时版面检查，至少包含状态、可见模块数、条目数和建议。
- 存在 `web/docs/pilot-readiness.md`，覆盖首批试点设置、测试脚本、反馈问题和运维检查。
- 未新增 runtime dependency。
- 未改动 Prisma schema。
- 未新增 LLM 调用或 quota 消耗。
- 未实现评分入口。
- 自动化检查全部通过。

## 2. 明确不验收的范围

以下内容不属于 Plan 6：

- 简历评分。
- 支付订阅、套餐购买、发票、退款。
- 模板市场。
- Word/PDF 模板上传识别。
- Cover Letter 或面试素材包。
- 服务端 headless PDF 生成端点。
- 真实数据分析 dashboard。

## 3. 自动化验收命令

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

通过标准：

- `pnpm test` 退出码为 0，且包含 `resume-library` 与 `resume-fit-advisor` 单测。
- `pnpm typecheck` 退出码为 0。
- `pnpm build` 退出码为 0。
- `pnpm test:e2e` 退出码为 0，且包含 `editor-v1.spec.ts`。

## 4. Library Experience 加入简历验收

步骤：

1. 用户创建至少两条经历。
2. 通过 JD 改写流程生成只包含其中一条经历的简历。
3. 进入 `/resume/[id]`。
4. 在左侧经历资产中点击另一条经历的「加入简历」。
5. 保存并刷新。

通过标准：

- 新增经历出现在内容编辑区域和预览区域。
- 新增经历的 section 类型与原经历类型匹配。
- 重复点击同一经历不会生成重复条目。
- 保存后刷新仍存在。
- 原个人信息库经历没有被编辑器改写或删除。

## 5. 自定义模块验收

步骤：

1. 在 `/resume/[id]` 点击「新增自定义模块」。
2. 修改模块标题为 `Awards`。
3. 在新模块中填写一个条目正文。
4. 保存并刷新。
5. 删除该模块或删除条目。

通过标准：

- 新模块以 `CUSTOM` section 存入当前简历 snapshot。
- 自定义模块保存后刷新仍存在。
- 删除模块只影响当前简历，不影响个人信息库。
- 删除条目只移除当前简历中的该条 item。

## 6. 版面检查验收

通过标准：

- `/resume/[id]` 显示 `版面检查`。
- 面板展示 `预计适合一页`、`内容接近一页上限` 或 `可能超过一页` 之一。
- 面板展示可见模块数量和条目数量。
- 面板至少展示一条具体建议。
- 修改内容或模板设置后面板会随 React state 重新计算。

## 7. PDF 兼容验收

通过标准：

- 新增 library experience 和自定义模块仍通过共享 `ResumeDocument` 渲染。
- `/resume/[id]/print` 不出现 app 侧边栏。
- e2e 验证 print route 包含新增 library experience。
- Plan 5 的 PDF e2e 继续通过。

## 8. Pilot 文档验收

`web/docs/pilot-readiness.md` 必须包含：

- 本地/试点环境 setup checklist。
- 从注册到 PDF 导出的用户测试脚本。
- 首批用户反馈问题。
- DeepSeek 与 mock provider 的使用说明。
- 备份、健康检查、发布 gate。
- 明确非目标：评分、支付、模板上传。

## 9. 失败判定

出现任一情况即视为未通过：

- 用户无法从信息库添加经历到当前简历。
- 添加经历会修改或删除原始 `Experience`。
- 同一经历能重复加入同一份简历。
- 自定义模块无法保存或刷新后丢失。
- 删除模块/条目影响个人信息库。
- 版面检查不存在。
- print route 不显示新增内容。
- 新增 runtime dependency 或 Prisma schema migration。
- 产生新的 LLM 调用或 quota 消耗。
- 实现评分入口。
- 任一自动化验收命令失败。
