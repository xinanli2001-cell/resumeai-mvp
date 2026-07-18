# ResumeAI 经历三模块与用户界面中文化交接

交接日期：2026-07-19

工作目录：`/Users/lixinan/Desktop/简历修改工具`

当前分支：`codex/plan8-render-staging-config`

## 1. 新对话的任务

按已确认设计完成两项工作：

1. 信息库新增、编辑、AI 导入和经历卡片统一为“背景 / 职责 / 成果”。
2. ResumeAI 所有用户可见静态界面文案统一为中文。

本次交接只完成设计与实施文档，**尚未修改任何产品代码，也未部署这批 UI 改动**。

## 2. 必读文档与执行顺序

1. 设计基线：`docs/superpowers/specs/2026-07-19-experience-sections-and-chinese-ui-design.md`
2. 先执行：`docs/superpowers/plans/2026-07-19-structured-experience-sections.md`
3. 再执行：`docs/superpowers/plans/2026-07-19-chinese-user-interface.md`

设计文档已由用户于 2026-07-19 确认。不要重新询问已经确定的产品方向；只有发现会改变范围或数据行为的真实歧义时再询问。

## 3. 已确认的关键决策

- 经历卡片采用方案 A：纵向依次展示“背景、职责、成果”。
- 左侧手动表单、AI 导入草稿和右侧卡片都统一三模块。
- 职责、成果按多行输入，每行一项。
- 复用现有 `structuredFields`：`summary`、`responsibilities`、`achievements`、可选 `pendingClaims`。
- 保存时同步生成中文模块标题的规范化 `rawText`，保证匹配、改写和快照链路继续可用。
- 不做数据库迁移，不改 Prisma 枚举或 API 英文协议值。
- 旧数据展示优先级：有效 `structuredFields` → 解析旧 `Responsibility:`/`Achievement:` → 全部 `rawText` 作为背景；只有无结构化成果时才用 `metrics` 回退。
- 未编辑旧记录不得被后台静默改写。
- 全站采用中文单语言界面，不引入完整 i18n。
- 保留 `ResumeAI`、`AI`、`JD`、`PDF`、`STAR`、`API`、`LinkedIn`、`GitHub`、`DeepSeek`，也不翻译用户内容、AI 输出、邮箱和邀请码。

## 4. 当前代码事实

- `web/src/app/(app)/library/library-client.tsx`
  - 卡片目前直接输出 `rawText`，成果另用 `metrics` 展示。
  - 手动表单目前仍是“原始描述 + 量化结果”。
  - `ExperienceItem` 尚未包含 `structuredFields`。
- `web/src/app/(app)/library/import-dialog.tsx`
  - 已写入结构化字段，但 `rawText` 仍生成英文 `Responsibility:` / `Achievement:`。
  - AI 草稿类型下拉仍显示英文枚举，默认标题是 `Imported Experience`。
- `web/src/app/(app)/library/page.tsx`
  - 服务端目前没有把 `structuredFields` 序列化给客户端。
- `web/src/lib/experience/experience-service.ts`
  - API 已接受 `structuredFields` JSON，无需新增路由或迁移。
- 已知未中文化内容分布在登录、注册、退出、信息库、匹配、设置、管理后台等页面；第二份计划列出了主要文件和审计方法。

## 5. 推荐接手方式

新对话开始后：

1. 阅读本交接、设计文档和两份计划。
2. 调用 `superpowers:using-git-worktrees`，为实现建立专用 worktree/功能分支；当前目录含用户未跟踪文件，不适合混合暂存。
3. 使用 `superpowers:subagent-driven-development` 在当前会话逐任务执行；若选择独立会话批量执行，则使用 `superpowers:executing-plans`。
4. 每项行为改动都遵循 `superpowers:test-driven-development`，先看到定向测试失败再写实现。
5. 完成后使用 `superpowers:verification-before-completion` 和 `superpowers:requesting-code-review`。
6. 先向用户提供本地预览验收；未经用户明确指令，不推送、不部署 staging/production。

## 6. Git 与工作区注意事项

交接生成前的最新设计提交为：

```text
1f4be5e docs: design structured experience cards and Chinese UI
```

当前目录已有以下与本功能提交无关的未跟踪内容：

```text
.superpowers/brainstorm/80402-1784387333/
docs/handoff-2026-07-16-invitation-codes.md
stitch_resumeai_workspace.zip
```

不要使用 `git add -A`。只显式暂存本功能文件。视觉讨论目录仅作临时参考，不提交。

## 7. 现有系统与 staging 状态

本 UI 工作开始前，现有主功能的最新验证已通过：

- Vitest：28 个文件、105 个测试通过。
- TypeScript 类型检查通过。
- Next.js 构建通过。
- Playwright：12 个常规 E2E + 1 个 invite-only E2E 通过。
- Render 配置校验、生产 Prisma schema 生成、staging smoke 均通过。
- staging 邀请码注册、额度增加、重复兑换拦截、停用后 403、管理员兑换记录已人工验收。

这些是交接前结果；实现完成必须重新运行门禁，不能直接沿用旧结论。

staging 仍有验收测试账号、邀请码与旧默认管理员账号。正式上线前还需清理测试数据、处理旧默认管理员，并轮换此前在截图中暴露过的环境变量与密钥。不得在文档、日志或回复中复述任何密钥值。

## 8. 完成门禁

在 `web/` 运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

此外必须人工验收：

- 新增、编辑、AI 导入和旧经历均正确展示三模块。
- 当前 staging 风格的 ResumeAI 示例不丢内容、不重复成果。
- 页面不再显示 `Responsibility:`、`Achievement:`、`blocks`。
- 全站用户可见静态文案均为中文；允许清单中的品牌和缩写除外。
- 375px 移动端无页面级横向溢出。
- 匹配、改写、简历、PDF、权限、邀请码和额度无回归。

## 9. 可直接复制给新对话的开场指令

```text
请阅读 docs/handoff-2026-07-19-experience-sections-chinese-ui.md，按其中的设计文档和两份实施计划接手工作。先建立隔离 worktree，严格按 TDD 逐任务执行，完成一项验证一项；不要改动后端英文协议值，不要暂存交接中列出的无关文件。全部门禁通过并完成代码审查后，先打开本地预览陪我验收，未经我确认不要推送或部署。
```
