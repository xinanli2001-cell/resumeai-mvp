# Plan 4 验收标准：Resume SaaS Deployment and Hardening

日期：2026-07-04  
对应计划：`docs/superpowers/plans/2026-07-04-resume-saas-deployment-hardening.md`  
验收对象：`web/` 应用的生产配置、安全加固、隐私删除、日志监控、Postgres 生产路径、备份、发布检查  
前置条件：Plan 1、2、3 已完成并可通过全部自动化检查

## 1. 验收结论标准

Plan 4 只有在以下条件全部满足时才算完成：

- 存在统一的、经 Zod 校验的配置模块，缺失/不合规的生产密钥会在加载时报错（fail-fast）。
- 生产环境下 `SESSION_SECRET` 过短会抛错；`LLM_PROVIDER=deepseek` 但无 key 会抛错。
- 全站响应带安全响应头（至少 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、CSP；生产附带 HSTS）。
- 会话 Cookie 在生产为 `secure`，且 `httpOnly` + `sameSite=lax`。
- 消耗成本的 LLM 路由（import / jd / rewrite）有按用户的速率限制与请求体大小限制。
- 用户能删除自己的资料数据，也能注销账号；删除只作用于本人数据，不影响他人，不删除系统模板。
- 日志与 `UsageLog` 不泄露密码、密钥、会话令牌等敏感信息（有脱敏保证）。
- 存在健康检查端点，可用于探活。
- LLM 调用失败时用户已输入内容不丢失（PRD §8.2）。
- 提供 PostgreSQL 生产迁移路径与部署文档。
- 提供数据库备份脚本与恢复文档。
- 提供发布前检查清单。
- **未实现 PDF 导出**（明确延后）。
- 自动化检查全部通过。

## 2. 明确不验收的范围

以下内容不属于 Plan 4，不能因为缺失而判定失败：

- **PDF 导出**（产品明确延后）。实现了 PDF 导出/打印路由/PDF 依赖反而视为越界失败。
- 简历评分。
- 支付订阅、模板市场、Word/PDF 模板上传识别。
- 多实例分布式速率限制（本计划明确单实例，仅需文档说明扩展方案）。

## 3. 自动化验收命令

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

通过标准：

- `pnpm test` 退出码为 0，且包含新增单测：`env-config`、`rate-limit`、`privacy-service`、`logger-redaction`。
- `pnpm typecheck` / `pnpm build` 退出码为 0。
- `pnpm test:e2e` 退出码为 0，且包含 `hardening.spec.ts`。

任一命令失败，Plan 4 不算完成。测试期间不得发起真实 LLM 网络请求、不得使用真实计时器依赖。

## 4. 配置与 fail-fast 验收

通过标准：

- 存在 `src/lib/config/env.ts`，所有密钥/URL/限额读取经其暴露的 `env()`。
- 生产 + `SESSION_SECRET` < 32 字符 → 加载抛错（单测覆盖）。
- 生产 + `LLM_PROVIDER=deepseek` + 空 key → 加载抛错（单测覆盖）。
- 开发环境使用默认值不抛错。
- `LLM_RATE_LIMIT_PER_MINUTE`、`MAX_TEXT_BYTES` 有默认值并可被环境覆盖。

## 5. 安全加固验收

通过标准：

- `middleware.ts` 为响应设置 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy`、CSP；生产附带 HSTS。
- 会话 Cookie：生产 `secure=true`，始终 `httpOnly` + `sameSite=lax`。
- import / jd / rewrite 路由：超过速率限制返回 429（在扣额度之前拦截）。
- import / jd 路由：文本超过 `MAX_TEXT_BYTES` 返回 413。
- 速率限制器为纯函数、可注入时钟、可单测（不用真实计时器）。
- 代码注释说明速率限制为单实例，横向扩展需共享存储。

## 6. 隐私删除验收

通过标准：

- `deleteUserData(userId)` 清除该用户的经历、JD、改写 session/块、简历、非系统模板，并将 Profile 重置为空默认值；不删除 `User` 行；不影响他人数据；不删除系统模板（单测覆盖）。
- `deleteAccount(userId)` 删除 `User` 并级联清理其数据，清除会话；不影响他人数据（单测覆盖）。
- `/settings` 页提供「删除我的资料数据」与「注销账号」两个带确认的破坏性操作。
- 删除路由只作用于当前登录用户，绝不接受 body 传入的 userId。
- 注销账号后重定向到 `/login`，原会话不再有效。

## 7. 日志、监控与韧性验收

通过标准：

- 日志器对 `password`、`passwordHash`、`authorization`、`apiKey`、`DEEPSEEK_API_KEY`、`SESSION_SECRET`、cookie/token 等键做脱敏（单测覆盖）。
- `UsageLog` 不存储原始 prompt、密钥或额外 PII。
- `GET /api/health` 返回 `{ status: "ok", appEnv }` 并做一次 DB 探活；DB 不可达返回 503；无鉴权、不泄露敏感信息。
- LLM 调用失败时返回明确错误且不清空用户已输入文本（import/jd 客户端不清空输入；rewrite 按块记 FAILED 不扣额度）。

## 8. 生产路径与备份验收

通过标准：

- 有文档说明将 datasource 从 `sqlite` 切换到 `postgresql` 的步骤，且确认 schema 无 SQLite 专有构造。
- 文档明确生产使用 `prisma migrate deploy`，并说明本地 `sqlite-migrate.ts` 仅限开发。
- `docs/deployment.md` 覆盖：所需环境变量、强 `SESSION_SECRET` 生成、生产 DeepSeek 配置、build/start、迁移、单实例限流说明、生产幂等 seed。
- `scripts/backup.ts` 对 SQLite 生成带时间戳的备份文件；对 Postgres 打印 `pg_dump` 指令；`package.json` 有 `db:backup`。
- 文档覆盖 SQLite 与 Postgres 的恢复步骤。

## 9. 发布检查验收

通过标准：

- `docs/release-checklist.md` 列出发布前门槛：环境变量校验、密钥强度、DeepSeek 配置、迁移、seed、安全头、限流、备份、健康检查、四项自动化检查全绿。

## 10. 端到端 Smoke Flow

必须能完成（mock provider，离线）：

1. 未登录访问 `GET /api/health` 返回 ok。
2. 登录用户在 `/settings` 删除自己的资料数据，信息库变空，但账号仍可登录。
3. 用户注销账号后重定向 `/login`，原会话不再通过鉴权。

通过标准：

- 全流程无 500 错误、无真实 LLM 网络请求、无 PDF 导出动作。
- 删除操作的权限边界正确（只动本人数据）。

## 11. 交付物验收

Plan 4 完成时应新增存在：

- `src/lib/config/env.ts`、`src/lib/security/rate-limit.ts`、`src/lib/privacy/privacy-service.ts`、`src/lib/logging/logger.ts`。
- `middleware.ts`。
- `src/app/api/health`、`src/app/api/account`（含 `data`）路由；`/settings` 页。
- 新增单测：`env-config`、`rate-limit`、`privacy-service`、`logger-redaction`。
- 端到端测试：`hardening.spec.ts`。
- `docs/deployment.md`、`docs/release-checklist.md`、`scripts/backup.ts`、更新的 `.env.example` 与 README。

## 12. 失败判定

出现任一情况即视为未通过：

- 生产缺失/弱密钥不报错，静默启动。
- 无安全响应头，或生产 Cookie 非 secure。
- LLM 路由无速率或体积限制。
- 用户删除操作能影响他人数据，或误删系统模板。
- 日志或 `UsageLog` 泄露密码/密钥/令牌。
- 无健康检查端点。
- LLM 失败导致用户输入丢失。
- 无 Postgres 生产路径或备份方案。
- 实现了 PDF 导出 / 打印路由 / PDF 依赖（越界）。
- 实现了评分入口。
- 自动化检查失败，或测试期间发起真实 LLM 网络请求 / 依赖真实计时器。
