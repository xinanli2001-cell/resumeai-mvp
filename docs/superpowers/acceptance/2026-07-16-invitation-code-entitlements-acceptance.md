# Plan 9 验收标准：Invitation Code Entitlements

日期：2026-07-16
对应计划：`docs/superpowers/plans/2026-07-16-invitation-code-entitlements.md`
验收对象：邀请码注册门禁、存量用户额度兑换、管理员运维与 staging 发布
前置条件：Plan 1-8 已完成，管理员账号可登录

## 1. 验收结论标准

只有以下条件全部满足时才算完成：

- 邀请码具有唯一 code、标签、最大使用次数、已用次数、每次赠送额度、
  启停状态、可选过期时间和兑换历史。
- 兑换只在 active、未过期且仍有容量时成功；停用、过期、用尽和不存在的
  code 都返回可理解的失败结果。
- 同一用户对同一 code 只能成功一次，重复请求不会重复增加额度或占用容量。
- 并发兑换通过数据库事务与 compare-and-set 容量更新保证不超发；竞争失败
  时不会留下用户、兑换记录或额度增量的部分写入。
- 成功兑换原子地增加 `User.quotaLimit`、增加 `usedCount` 并写入
  `InvitationRedemption`；新额度在刷新页面和重新登录后仍存在。
- `REGISTRATION_MODE=open` 允许无 code 注册；`invite_only` 要求有效 code，
  且注册与兑换位于同一事务中。
- 已登录普通用户可在 Settings 兑换 code，并看到更新后的可用额度；重复或
  不可用 code 有明确提示。
- 只有管理员能创建、列出和更新邀请码；普通用户不能读取 code、兑换邮箱或
  修改状态。
- 管理后台可创建、复制、查看容量/状态/额度/到期时间、查看最近兑换邮箱和
  时间，并可停用或重新启用仍有效的 code。
- 管理后台能区分可用、已停用、已过期和已用完，窄屏表格在卡片内横向滚动。
- 本地 SQLite 与生成的生产 PostgreSQL schema 都包含新增模型和约束，现有
  数据无需破坏性重建，部署继续使用既有 rollback-safe `db push` 启动路径。
- 环境示例、pilot、cloud runbook 与 release checklist 已覆盖注册模式和操作员
  流程。
- 邀请码只授予应用额度，不暴露真实 LLM API key，也不绕过认证、输入限制、
  quota enforcement 或 LLM rate limit。

## 2. 明确排除范围

- 邀请码不等同于付费、订阅、账单或退款系统。
- 不提供公开邀请码目录、批量营销分发或自助购买。
- 不允许邀请码绕过登录、请求大小限制、额度扣减或 LLM 限流。
- 不在客户端、日志、API 响应或邀请码中暴露 DeepSeek 等供应商密钥。
- 不反向撤销已经成功发放的额度；停用只阻止后续兑换。
- 不新增 resume scoring、模板市场或 Word/PDF 上传解析。

## 3. 自动化验收命令

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
STAGING_BASE_URL="https://resumeai-staging.onrender.com" pnpm smoke:staging
```

通过标准：所有命令退出码为 0；单元测试覆盖容量、并发、重复兑换、注册模式、
管理员授权和异常输入；Playwright 覆盖注册、Settings 与管理员流程。

## 4. 注册与 Settings 验收

- open 模式下原有注册路径不受影响。
- invite-only 模式下缺少或无效 code 不创建用户；有效 code 同时创建用户、
  兑换记录并增加初始 quota。
- Settings 成功兑换后立即显示新的可用额度，刷新后保持一致。
- 同一用户重复兑换不会再次改变 quota；停用、过期或用尽 code 不改变数据。
- 桌面与 375px 移动端字段、标签、卡片 padding 和反馈信息无重叠或页面级
  横向溢出。

## 5. 管理员验收

- 未登录或普通用户访问 admin API/页面会被拒绝，且不能观察邀请码数据。
- 管理员能创建具有正整数容量和赠送额度、可选未来到期时间的 code；严格
  拒绝多余字段、畸形 JSON、过去时间和越界数值。
- 列表只返回运维需要的字段，每个 code 的最近兑换记录限制为五条。
- 停用是原子更新；已停用 code 无法兑换。过期但仍 active 的 code 可以停用，
  但已过期 code 不能重新启用为可兑换状态。
- 桌面和 375px 移动端管理面板无页面级横向溢出；宽表格保留卡片内滚动。

## 6. Staging 操作验收

1. closed-beta staging 从首次部署即使用 `REGISTRATION_MODE=invite_only`。
2. 用 seeded admin 登录并创建首个 active code，再邀请 tester 注册。
3. 确认无 code 注册失败，有效 code 注册成功，Settings 可追加额度。
4. 在 `/admin` 确认兑换邮箱/时间，停用测试 code，并确认后续兑换失败。
5. 运行 staging smoke，确认 health、安全响应头、login 和未登录 redirect 正常。
6. 只有在明确批准 public registration 时才切换为 `open`。

## 7. 失败判定

任一情况出现即未通过：容量超发、重复加额、注册失败留下部分用户、普通用户
读取管理员数据、额度刷新后丢失、停用 code 仍可兑换、数据库升级破坏现有数据、
自动化命令失败，或 staging 未完成 health 与邀请码人工 smoke。
