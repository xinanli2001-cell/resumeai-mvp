# Plan 5 验收标准：Resume SaaS PDF Export

日期：2026-07-04  
对应计划：`docs/superpowers/plans/2026-07-04-resume-saas-pdf-export.md`  
验收对象：`web/` 应用的简历 PDF 导出（打印路由 + 共享渲染 + 浏览器另存为 PDF）  
前置条件：Plan 1–4 已完成并可通过全部自动化检查

## 1. 验收结论标准

Plan 5 只有在以下条件全部满足时才算完成：

- 简历编辑页提供「导出 PDF」入口。
- 存在脱离应用侧边栏的打印路由 `/resume/[id]/print`，只渲染简历本身。
- PDF 输出复用 `Resume.contentSnapshot` + `Template.config`，与编辑器屏幕预览一致（同一渲染组件，不漂移）。
- 切换/自定义模板改变 PDF 表现，但不改变简历文字内容。
- 双语内容按改写阶段产出的文本原样呈现。
- 打印路由强制服务端鉴权与所有权校验（`requireUser` + `getResume`），用户不能访问他人简历的打印页。
- 打印页使用 A4 打印 CSS，不泄露应用导航等页面框架。
- 能真实产出有效 PDF（e2e 用 Playwright `page.pdf()` 断言 `%PDF-` 头）。
- 未新增运行时依赖。
- 未改动简历/模板数据模型。
- 自动化检查全部通过。

## 2. 明确不验收的范围

以下内容不属于 Plan 5，不能因为缺失而判定失败：

- 服务端一键 headless-chromium 渲染 PDF 端点（明确为后续可选升级）。
- 简历评分。
- 支付订阅、模板市场、Word/PDF 模板上传识别。
- 对简历/模板 schema 的任何变更（本计划不需要）。

## 3. 自动化验收命令

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

通过标准：

- `pnpm test` 退出码为 0，且包含新增单测：`resume-render`。
- `pnpm typecheck` / `pnpm build` 退出码为 0，且构建包含 `/resume/[id]/print` 路由。
- `pnpm test:e2e` 退出码为 0，且包含 `pdf-export.spec.ts`。

任一命令失败，Plan 5 不算完成。测试期间不得发起真实 LLM 网络请求。

## 4. 共享渲染验收

通过标准：

- 存在 `src/lib/resume/render.ts` 的纯函数（section 排序、显隐过滤、标题样式），有单测覆盖。
- 存在 `src/components/resume/resume-document.tsx`，为纯展示组件（无编辑控件、无数据获取）。
- 编辑器预览改用 `ResumeDocument` 渲染；打印路由也用 `ResumeDocument`——二者同一实现。
- `orderedSectionsForRender` 按 `config.sectionOrder` 排序、排除隐藏 section、未列入顺序的类型追加在后（与编辑器现有逻辑一致）。

## 5. 打印路由验收

通过标准：

- 路由 `/resume/[id]/print` 存在，位于独立 `(print)` 路由组，使用最小布局，不渲染侧边栏/页头。
- 打印页服务端 `requireUser` 且经 `getResume(user.id, id)` 校验所有权；他人简历的打印页不可访问（404/重定向）。
- 打印 CSS 设置 A4 页面与边距；`@media print` 下不出现应用导航等框架元素。
- 页面含自动 `window.print()` 触发与可见的「打印 / 保存为 PDF」手动按钮（按钮在打印时隐藏）。

## 6. 导出交互验收

通过标准：

- 编辑器工具栏有「导出 PDF」按钮，点击打开 `/resume/[id]/print`。
- 导出反映最新已保存内容（有未保存修改时禁用导出或先自动保存，二选一，行为清晰）。
- 切换模板后再导出，PDF 样式随之变化，文字内容不变。

## 7. PDF 产出验收

通过标准：

- e2e 在打印路由用 Playwright `page.pdf({ format: "A4", printBackground: true })` 产出 PDF。
- 断言 PDF 字节非空且以 `%PDF-` 开头。
- 打印页断言只含简历内容、不含应用侧边栏。

## 8. 端到端 Smoke Flow

必须能完成（mock provider，离线）：

1. 新用户注册登录 → 导入确认经历 → JD 改写确认 ≥1 段 → 生成简历 → 进入编辑器。
2. 打开 `/resume/[id]/print`，页面只渲染简历、无侧边栏。
3. 产出有效 PDF（`%PDF-` 头，非空）。

通过标准：

- 全流程无 500 错误、无真实 LLM 网络请求。
- 打印页权限边界正确（仅本人简历可导出）。

## 9. 交付物验收

Plan 5 完成时应新增存在：

- `src/lib/resume/render.ts`、`src/components/resume/resume-document.tsx`。
- `src/app/(print)/layout.tsx`、`src/app/(print)/resume/[id]/print/page.tsx` 及其 `print-client.tsx`、打印样式表。
- 编辑器 `resume-client.tsx` 改用共享渲染并新增「导出 PDF」。
- 新增单测：`resume-render`。
- 端到端测试：`pdf-export.spec.ts`。
- 更新的 README。

## 10. 失败判定

出现任一情况即视为未通过：

- 无「导出 PDF」入口或打印路由。
- PDF 与编辑器预览渲染不一致（存在两套渲染实现导致漂移）。
- 导出/切换模板改变了简历文字内容。
- 打印页带出应用侧边栏/导航等框架。
- 用户能访问或导出他人简历的打印页。
- e2e 未能产出有效 `%PDF-`。
- 新增了运行时依赖，或改动了简历/模板 schema。
- 实现了评分入口。
- 自动化检查失败，或测试期间发起真实 LLM 网络请求。
