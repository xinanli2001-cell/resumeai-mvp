# ResumeAI 用户界面中文化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan. Apply superpowers:test-driven-development for behavior changes and superpowers:verification-before-completion before claiming completion.

**Goal:** 将 ResumeAI 所有用户可见的静态界面文案统一为中文，同时保留品牌、缩写、技术词、用户内容以及后端/API 的英文协议值。

**Architecture:** 页面静态文案直接中文化；经历类型、用户角色、邀请状态和重复状态值集中到一个无副作用标签模块。API 错误在客户端显示边界映射为中文，不能改变 HTTP 状态、权限、额度或枚举协议。

**Tech Stack:** Next.js 15、React 19、TypeScript、Vitest、Playwright

---

关联设计：`docs/superpowers/specs/2026-07-19-experience-sections-and-chinese-ui-design.md`

## 执行前约束

- [ ] 先完成 `2026-07-19-structured-experience-sections.md`，避免两份计划同时修改信息库组件。
- [ ] 不翻译：`ResumeAI`、`AI`、`JD`、`PDF`、`STAR`、`API`、`LinkedIn`、`GitHub`、`DeepSeek`、邮箱、邀请码、用户输入和 AI 生成内容。
- [ ] 不改变 Prisma 枚举、请求体、响应体、错误状态码和内部日志。

## Task 1：建立共享中文领域标签

**Files:**

- Create: `web/src/lib/ui/labels.ts`
- Create: `web/tests/unit/ui-labels.test.ts`
- Modify: `web/src/app/(app)/library/library-client.tsx`
- Modify: `web/src/app/(app)/library/import-dialog.tsx`
- Modify later where applicable: `web/src/app/(admin)/admin/admin-client.tsx`

- [ ] 先写测试，锁定英文值到中文显示值的映射和未知值回退：

```ts
import { describe, expect, it } from "vitest";
import { experienceTypeLabel, userRoleLabel, invitationStatusLabel } from "../../src/lib/ui/labels";

describe("Chinese UI labels", () => {
  it("keeps protocol values English and returns Chinese display labels", () => {
    expect(experienceTypeLabel("PROJECT")).toBe("项目经历");
    expect(userRoleLabel("ADMIN")).toBe("管理员");
    expect(invitationStatusLabel("ACTIVE")).toBe("可用");
  });

  it("falls back safely for unknown values", () => {
    expect(userRoleLabel("OWNER")).toBe("OWNER");
  });
});
```

- [ ] 运行定向测试，确认先红。
- [ ] 实现映射函数。至少覆盖经历类型 `EDUCATION/PROJECT/INTERNSHIP/WORK/SKILL`、角色 `USER/ADMIN`、邀请码或页面实际使用的状态值。
- [ ] 将两个信息库下拉和分类标题接入共享映射；`option.value` 保持英文。
- [ ] 运行 `pnpm vitest run tests/unit/ui-labels.test.ts`，预期通过。
- [ ] 提交：`git commit -m "feat: add shared Chinese UI labels"`。

## Task 2：中文化登录、注册、导航和账号入口

**Files:**

- Modify: `web/src/app/(public)/login/page.tsx`
- Modify: `web/src/app/(public)/register/register-form.tsx`
- Modify: `web/src/app/(app)/app-shell.tsx`
- Modify: `web/src/app/(app)/logout-button.tsx`
- Modify: `web/tests/e2e/foundation.spec.ts`
- Modify: `web/tests/e2e/library-layout.spec.ts`
- Modify: `web/tests/e2e/library-onboarding.spec.ts`

- [ ] 先将 E2E 选择器改为用户最终看到的中文：`邮箱`、`密码`、`登录`、`创建账号`、`退出登录`；运行相关用例并确认先失败。
- [ ] 替换登录/注册中的 `Welcome back`、`Email Address`、`Password`、`Sign In`、`Build your story`、`Get started`、`Create Account`，包括 `aria-label` 和校验反馈。
- [ ] 将 `Sign Out` 改为 `退出登录`；将 `ResumeAI Workspace` 改为 `ResumeAI 工作台`，保留 ResumeAI 品牌名。
- [ ] 确保可访问名称与可见按钮一致，不能只改视觉文字而遗留英文 aria-label。
- [ ] 运行：

```bash
pnpm playwright test tests/e2e/foundation.spec.ts tests/e2e/library-layout.spec.ts tests/e2e/library-onboarding.spec.ts
```

- [ ] 预期全部通过。
- [ ] 提交：`git commit -m "feat: localize authentication and navigation UI"`。

## Task 3：中文化信息库、JD 匹配与改写流程

**Files:**

- Modify: `web/src/app/(app)/library/first-run-library-panel.tsx`
- Modify: `web/src/app/(app)/library/import-dialog.tsx`
- Modify: `web/src/app/(app)/library/library-client.tsx`
- Modify: `web/src/app/(app)/match/match-client.tsx`
- Modify: `web/src/app/(app)/match/page.tsx`
- Modify: `web/src/app/(app)/rewrite/[id]/rewrite-client.tsx`
- Modify: `web/tests/e2e/ai-flow.spec.ts`
- Modify: `web/tests/e2e/hardening.spec.ts`

- [ ] 先补充 E2E 断言，阻止已知英文界面文案回归：`Profile`、`Experience`、`blocks`、`Target Role`；注意不禁止合法的 `AI`、`JD`、`STAR`。
- [ ] 信息库眉题改为中文；AI 导入 placeholder 使用中文示例，默认标题使用 `导入的经历`。
- [ ] JD 匹配与改写页面逐项翻译标题、按钮、表头、加载、成功、空状态、决策状态和可访问名称。
- [ ] 对 API 返回的 `Quota exceeded` 等英文错误，在界面边界映射为 `额度已用完` 等中文；不要修改服务层用于判断的英文常量。
- [ ] 运行相关 E2E，预期通过；同时确认英文 JD、用户经历和 AI 输出原文不被翻译。
- [ ] 提交：`git commit -m "feat: localize library matching and rewrite UI"`。

## Task 4：中文化简历、设置和管理后台

**Files:**

- Modify: `web/src/app/(app)/resumes/page.tsx`
- Modify: `web/src/app/(app)/resume/[id]/resume-client.tsx`
- Modify: `web/src/app/(print)/resume/[id]/print/print-client.tsx`
- Modify if static UI exists: `web/src/components/resume/resume-document.tsx`
- Modify: `web/src/app/(app)/settings/settings-client.tsx`
- Modify: `web/src/app/(admin)/admin/page.tsx`
- Modify: `web/src/app/(admin)/admin/admin-client.tsx`
- Modify: `web/tests/e2e/resume-flow.spec.ts`
- Modify: `web/tests/e2e/editor-v1.spec.ts`
- Modify: `web/tests/e2e/pdf-export.spec.ts`
- Modify: `web/tests/e2e/invitation-redemption.spec.ts`
- Modify: `web/tests/e2e/invitation-invite-only.spec.ts`

- [ ] 先更新受影响 E2E 选择器和断言，覆盖简历编辑/导出、设置额度/邀请码、管理员用户/邀请码/兑换记录。
- [ ] 翻译简历列表、编辑器、模板、PDF 导出、空状态和操作反馈；PDF 中的用户内容不翻译。
- [ ] 将 `Settings`、`Rewrite quota` 等设置页静态文案中文化。
- [ ] 将 `Administration`、`Accounts`、`Email`、`Role`、`Quota Limit`、`Used`、`Created`、`Action`、`Save`、`Invitations`、`Status`、`Recent redemptions`、`Activity` 等管理后台文案中文化。
- [ ] 角色和状态必须使用 Task 1 的共享映射；邮箱、邀请码保持原文。
- [ ] 运行上述五个 E2E 文件，预期通过。
- [ ] 提交：`git commit -m "feat: localize resume settings and admin UI"`。

## Task 5：静态文案审计与全量验收

**Files:**

- Create: `web/tests/unit/chinese-ui-copy.test.ts`
- Modify: any user-facing `.tsx` discovered by the audit

- [ ] 写一个范围明确的静态回归测试，扫描 `src/app` 与 `src/components` 的 `.tsx`，只禁止已经确认应翻译的词组；不要使用“禁止全部 ASCII”之类会误伤品牌和代码的规则。
- [ ] 禁止词至少包含：

```ts
[
  "Administration", "Accounts", "Email Address", "Create Account",
  "Sign In", "Sign Out", "Profile", "Experience", " blocks",
  "Target Role", "Settings", "Rewrite quota", "Imported Experience",
]
```

- [ ] 对 `Responsibility:`、`Achievement:` 另做运行时/生成内容断言；兼容解析器源码允许保留这两个旧格式常量。
- [ ] 人工扫描：

```bash
rg -n --glob '*.tsx' 'Administration|Accounts|Email Address|Create Account|Sign In|Sign Out|Profile|Experience|blocks|Target Role|Settings|Rewrite quota|Imported Experience' src/app src/components
```

- [ ] 审阅每个剩余命中，只允许代码标识符或明确例外；任何用户可见命中必须修改。
- [ ] 运行全量门禁：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

- [ ] 在 375px 与桌面宽度人工走查登录、注册、信息库、匹配、改写、简历、设置、管理后台；确认无英文静态文案、无横向溢出。
- [ ] 运行 `git diff --check`；逐条复核设计文档第 8、10–12 节，确认没有误翻译品牌、缩写、技术名词和用户内容。
- [ ] 使用 `superpowers:requesting-code-review` 审查，修复后重跑受影响门禁。
- [ ] 最终提交：`git commit -m "test: enforce Chinese user interface copy"`。
