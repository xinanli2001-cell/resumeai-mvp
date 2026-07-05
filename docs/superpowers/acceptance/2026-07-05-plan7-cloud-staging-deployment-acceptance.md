# Plan 7 验收标准：Cloud Staging Deployment

日期：2026-07-05
对应计划：`docs/superpowers/plans/2026-07-05-cloud-staging-deployment.md`
验收对象：`web/` 应用的云端 staging 部署准备
前置条件：Plan 1-6 已完成并通过本地自动化检查

## 1. 验收结论标准

Plan 7 只有在以下条件全部满足时才算完成：

- 存在 cloud staging design spec、implementation plan、acceptance doc。
- 存在 `web/docs/cloud-staging-runbook.md`。
- 本地 SQLite 开发路径保持不变。
- 生产 PostgreSQL Prisma schema 通过脚本生成，不要求手工编辑 `prisma/schema.prisma`。
- `package.json` 提供 `db:generate:prod` 和 `db:migrate:prod`。
- 存在 staging smoke 脚本，并可通过 `STAGING_BASE_URL=... pnpm smoke:staging` 调用。
- smoke 脚本验证 health、security headers、login 可达、未登录访问 `/library` 会重定向。
- release checklist 更新为 Plan 5/6/7 当前状态。
- 云端 runbook 覆盖环境变量、build、release/start、migration、seed、health、backup、rollback、manual pilot smoke。
- 未新增 resume scoring、payments、template marketplace、upload parsing。
- 未引入多实例依赖或 Redis，除非另有后续计划批准。
- 本地完整自动化检查全部通过。

## 2. 明确不验收的范围

以下内容不属于 Plan 7：

- 由 Codex 直接创建云平台账号或购买服务。
- 正式 public production launch。
- 多实例、Redis、队列、对象存储。
- 支付订阅。
- 模板市场。
- Word/PDF 模板上传识别。
- 简历评分。

## 3. 自动化验收命令

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

通过标准：

- `pnpm test` 退出码为 0，且包含 `create-postgres-schema` 和 `smoke-staging` 单测。
- `pnpm typecheck` 退出码为 0。
- `pnpm build` 退出码为 0。
- `pnpm test:e2e` 退出码为 0。

## 4. PostgreSQL Schema 生成验收

通过标准：

- `pnpm db:generate:prod` 成功生成 PostgreSQL Prisma Client。
- `prisma/generated/schema.postgres.prisma` 中 datasource provider 为 `postgresql`。
- 原始 `prisma/schema.prisma` 仍保持 `provider = "sqlite"`。
- 生成逻辑只替换 datasource provider，不改模型定义。
- 生成文件不需要手工编辑。

## 5. Staging Smoke 验收

通过标准：

- 未设置 `STAGING_BASE_URL` 时，`pnpm smoke:staging` 明确报错。
- 设置 `STAGING_BASE_URL` 后，脚本请求：
  - `/api/health`
  - `/login`
  - `/library`
- `/api/health` 必须返回 `{ status: "ok" }`。
- health 响应必须带安全头。
- `/login` 必须可达。
- 未登录访问 `/library` 必须重定向。

## 6. Cloud Runbook 验收

`web/docs/cloud-staging-runbook.md` 必须覆盖：

- 推荐部署形态：single Node service + managed PostgreSQL。
- 为什么 staging 暂不多实例。
- 完整 env var checklist。
- build command。
- release/start command。
- migration/seed command。
- smoke command。
- manual pilot smoke。
- backup and restore。
- rollback。

## 7. 失败判定

出现任一情况即视为未通过：

- 仍要求手工改 `prisma/schema.prisma` 才能部署 PostgreSQL。
- 云端 runbook 缺少 env、migration、seed、backup 或 smoke 任一关键步骤。
- smoke 脚本不能验证 health/security/auth redirect。
- 本地 SQLite 开发路径被破坏。
- 新增评分、支付、模板市场或上传解析范围。
- 自动化检查失败。
