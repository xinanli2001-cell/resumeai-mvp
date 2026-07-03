# Plan 1 验收标准：Resume SaaS MVP Foundation

日期：2026-07-03  
对应计划：`docs/superpowers/plans/2026-07-03-resume-saas-mvp-foundation.md`  
验收对象：`web/` Next.js SaaS 基础平台

## 1. 验收结论标准

Plan 1 只有在以下条件全部满足时才算完成：

- 本地可以启动 `web/` 应用。
- 普通用户可以注册、登录、退出。
- 普通用户只能访问自己的个人信息库数据。
- 管理员可以访问最小后台。
- 管理员可以查看用户、调整额度、设置/取消管理员身份。
- 普通用户有额度限制。
- 管理员不受额度限制。
- 个人信息库支持基本信息、联系方式、求职属性、教育、项目、实习、工作、职业能力。
- 项目/实习/工作经历以完整经历块保存，不以 bullet point 作为主数据单元。
- 自动化检查全部通过。
- 端到端 smoke flow 可以从新用户注册跑到管理员后台查看该用户。

## 2. 明确不验收的范围

以下内容不属于 Plan 1，不能因为缺失而判定 Plan 1 失败：

- AI 自由文本拆解。
- JD 解析。
- 经历推荐。
- STAR 改写确认页。
- 包装模式。
- 中英双语生成。
- 简历编辑器。
- 模板自定义。
- PDF 导出。
- 支付订阅。
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

- `pnpm test` 退出码为 0。
- `pnpm typecheck` 退出码为 0。
- `pnpm build` 退出码为 0。
- `pnpm test:e2e` 退出码为 0。

如果任一命令失败，Plan 1 不算完成。

## 4. 本地环境验收

在 `/Users/lixinan/Desktop/简历修改工具/web` 中运行：

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
pnpm dev
```

通过标准：

- 应用在 `http://localhost:3000` 可访问。
- seeded 管理员账号可登录。
- seeded 示例学生账号可登录。
- 数据库初始化和 seed 不报错。

## 5. 账号与权限验收

### 普通用户

步骤：

1. 注册一个新账号。
2. 登录。
3. 进入 `/library`。
4. 新增或修改个人信息库数据。
5. 退出登录。
6. 用另一个普通用户登录。
7. 访问 `/library`。

通过标准：

- 新账号注册成功后能进入信息库。
- 用户 A 的数据不会出现在用户 B 的信息库中。
- 未登录访问 `/library` 会跳转登录页。
- 普通用户访问 `/admin` 会被拒绝或重定向。

### 管理员

步骤：

1. 用 seeded 管理员登录。
2. 进入 `/admin`。
3. 查看用户列表。
4. 修改某个普通用户额度。
5. 将某个用户设置为管理员，再取消管理员。

通过标准：

- 管理员可以进入后台。
- 后台显示用户邮箱、角色、额度上限、已用额度。
- 管理员可以保存额度变更。
- 管理员可以设置和取消管理员角色。
- 管理员自身生成额度不受限制。

## 6. 个人信息库验收

信息库页面必须至少包含这些分区：

- 基本信息。
- 联系方式。
- 求职属性。
- 教育经历。
- 项目经历。
- 实习经历。
- 工作经历。
- 职业能力。

通过标准：

- 用户可以保存基本信息：姓名、所在地、目标岗位、简介。
- 用户可以保存联系方式：电话、邮箱、LinkedIn、GitHub、个人网站。
- 用户可以保存求职属性：目标城市、签证/工作权限、语言能力。
- 用户可以新增项目经历。
- 用户可以新增实习经历。
- 用户可以新增工作经历。
- 用户可以新增教育经历。
- 用户可以新增职业能力。
- 经历卡片显示类型、标题、组织、角色、时间、技能、标签、原始描述。
- 用户刷新页面后，已保存内容仍存在。
- 用户可以归档经历，归档后默认列表不再显示。

## 7. 额度与用量验收

通过标准：

- 普通用户有 `quotaLimit` 和 `quotaUsed`。
- 管理员有无限使用逻辑，或至少在 quota service 中绕过普通额度限制。
- `recordUsage` 成功记录后，普通用户 `quotaUsed` 增加。
- `recordUsage` 成功记录后，管理员 `quotaUsed` 不作为限制条件。
- 普通用户超额时抛出或返回 `Quota exceeded`。
- 后台能看到用户额度信息。

## 8. 数据模型验收

Prisma schema 至少包含：

- `User`
- `Profile`
- `Experience`
- `UsageLog`
- `UserRole`
- `ExperienceType`
- `ExperienceStatus`

通过标准：

- `User.email` 唯一。
- `User.role` 支持 `USER` 和 `ADMIN`。
- `Profile.userId` 唯一，和用户一对一。
- `Experience.userId` 绑定所有者。
- `Experience.type` 支持 `PROJECT`、`INTERNSHIP`、`WORK`、`EDUCATION`、`SKILL`。
- `Experience.status` 支持 `ACTIVE`、`ARCHIVED`。
- `UsageLog` 能记录 action type、cost units、状态和关联对象。

## 9. 端到端 Smoke Flow

必须能完成以下路径：

1. 新用户注册。
2. 新用户登录。
3. 新用户进入信息库。
4. 新用户填写基本信息和联系方式。
5. 新用户新增一个项目经历。
6. 新用户刷新页面，数据仍存在。
7. 新用户退出。
8. 管理员登录。
9. 管理员进入后台。
10. 管理员看到新用户。
11. 管理员调整新用户额度。

通过标准：

- 全流程不出现 500 错误。
- 用户输入不会在正常保存后丢失。
- 权限边界符合预期。

## 10. 交付物验收

Plan 1 完成时应存在：

- `web/` 应用源码。
- `.env.example`。
- Prisma schema 和 migration。
- seed 脚本。
- unit tests。
- e2e smoke test。
- README 或开发说明，至少包含启动命令、测试命令、seed 账号说明。

## 11. 失败判定

出现任一情况即视为未通过：

- 普通用户能看到其他用户的数据。
- 普通用户能访问管理员后台。
- 管理员无法调整用户额度。
- 信息库没有基本信息或联系方式。
- 项目/实习/工作经历无法作为完整经历块保存。
- 端到端 smoke flow 不能完成。
- 自动化检查失败。
- 实现了评分入口或把评分作为 Plan 1 范围。
