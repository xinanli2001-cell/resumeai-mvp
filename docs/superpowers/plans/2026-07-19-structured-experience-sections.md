# ResumeAI 经历三模块实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan. Apply superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before claiming completion.

**Goal:** 将信息库中的新增、编辑、AI 导入和经历卡片统一为“背景 / 职责 / 成果”三模块，同时兼容既有数据和现有匹配、改写链路。

**Architecture:** 以现有 `structuredFields` JSON 为结构化真源，新增一个无副作用转换器，集中处理新结构、旧英文前缀和 `metrics` 回退。界面编辑三模块时同步生成规范化 `rawText`，数据库与 API 英文枚举不变，不做 Prisma 迁移。

**Tech Stack:** Next.js 15、React 19、TypeScript、Prisma、Vitest、Playwright、Tailwind CSS

---

关联设计：`docs/superpowers/specs/2026-07-19-experience-sections-and-chinese-ui-design.md`

## 执行前检查

- [ ] 在专用 worktree/功能分支中执行，先运行 `git status --short`，保留用户已有未跟踪文件。
- [ ] 不暂存 `.superpowers/brainstorm/`、`docs/handoff-2026-07-16-invitation-codes.md`、`stitch_resumeai_workspace.zip`。
- [ ] 在 `web/` 运行基线：`pnpm test && pnpm typecheck`，确认改动前为绿色。

## Task 1：用测试定义三模块转换规则

**Files:**

- Create: `web/src/lib/experience/experience-sections.ts`
- Create: `web/tests/unit/experience-sections.test.ts`

- [ ] 先创建单元测试，覆盖以下精确规则：

```ts
import { describe, expect, it } from "vitest";
import {
  buildExperienceRawText,
  splitLines,
  toExperienceSections,
} from "../../src/lib/experience/experience-sections";

describe("toExperienceSections", () => {
  it("prefers valid structured fields and does not duplicate metrics", () => {
    expect(toExperienceSections({
      rawText: "legacy text",
      structuredFields: {
        summary: "项目背景",
        responsibilities: ["负责规划"],
        achievements: ["完成上线"],
      },
      metrics: ["完成上线"],
    })).toEqual({
      background: "项目背景",
      responsibilities: ["负责规划"],
      achievements: ["完成上线"],
    });
  });

  it("parses legacy English prefixes", () => {
    expect(toExperienceSections({
      rawText: "项目背景\nResponsibility: 负责规划\nAchievement: 完成上线",
      structuredFields: {},
      metrics: [],
    })).toEqual({
      background: "项目背景",
      responsibilities: ["负责规划"],
      achievements: ["完成上线"],
    });
  });

  it("uses raw text as background and metrics as the achievement fallback", () => {
    expect(toExperienceSections({
      rawText: "只有背景",
      structuredFields: null,
      metrics: ["提升 20%"],
    })).toEqual({
      background: "只有背景",
      responsibilities: [],
      achievements: ["提升 20%"],
    });
  });
});

describe("experience section serialization", () => {
  it("splits non-empty lines and emits Chinese module titles", () => {
    expect(splitLines("负责规划\n\n 推动上线 ")).toEqual(["负责规划", "推动上线"]);
    expect(buildExperienceRawText({
      background: "项目背景",
      responsibilities: ["负责规划"],
      achievements: ["完成上线"],
    })).toBe("背景：\n项目背景\n\n职责：\n负责规划\n\n成果：\n完成上线");
  });
});
```

- [ ] 运行 `pnpm vitest run tests/unit/experience-sections.test.ts`，确认因模块不存在而失败。
- [ ] 实现并导出以下稳定接口：

```ts
export type ExperienceSections = {
  background: string;
  responsibilities: string[];
  achievements: string[];
};

export function splitLines(value: string): string[];
export function toExperienceSections(input: {
  rawText?: unknown;
  structuredFields?: unknown;
  metrics?: unknown;
}): ExperienceSections;
export function buildExperienceRawText(sections: ExperienceSections): string;
```

- [ ] 转换器必须容忍 `null`、数组、未知字段和错误类型；若解析失败，完整 `rawText` 回退为背景。
- [ ] 结构化字段只要任一模块有效就优先；成果已存在时不得再附加 `metrics`；空行去除，非字符串项目忽略。
- [ ] 再运行定向测试，预期全部通过。
- [ ] 提交：`git commit -m "test: define structured experience compatibility"`。

## Task 2：把服务端结构化数据安全传给客户端

**Files:**

- Modify: `web/src/app/(app)/library/page.tsx`
- Modify: `web/src/app/(app)/library/library-client.tsx`
- Test: `web/tests/unit/experience-sections.test.ts`

- [ ] 在 `ExperienceItem` 增加 `structuredFields: unknown`，保持它只作为展示转换器输入。
- [ ] 在 `LibraryPage` 的 `initialExperiences` 映射中加入：

```ts
structuredFields: experience.structuredFields,
```

- [ ] 不在服务端渲染阶段修改或持久化旧记录。
- [ ] 运行 `pnpm typecheck`，预期退出码 0。
- [ ] 提交：`git commit -m "feat: expose structured experience fields to library"`。

## Task 3：将左侧新增/编辑表单改为三模块

**Files:**

- Modify: `web/src/app/(app)/library/library-client.tsx`
- Modify: `web/src/app/(app)/library/import-dialog.tsx`
- Test: `web/tests/e2e/library-onboarding.spec.ts`

- [ ] 先更新 onboarding E2E：新增经历时填写 `背景`、`职责`、`成果`，保存后断言右侧三个标题和对应内容可见；此时测试应因字段不存在而失败。
- [ ] 将 `emptyExperience` 中的 `rawText`、`metrics` 替换为：

```ts
background: "",
responsibilities: "",
achievements: "",
```

- [ ] 保存时使用：

```ts
const sections = {
  background: experienceForm.background.trim(),
  responsibilities: splitLines(experienceForm.responsibilities),
  achievements: splitLines(experienceForm.achievements),
};
const payload = {
  ...sharedFields,
  rawText: buildExperienceRawText(sections),
  structuredFields: {
    summary: sections.background,
    responsibilities: sections.responsibilities,
    achievements: sections.achievements,
  },
  metrics: [],
};
```

- [ ] 编辑时调用 `toExperienceSections(experience)` 回填三个字段；编辑旧经历后保存即升级为新结构。
- [ ] 表单渲染为三个 textarea：`背景`、`职责（每行一项）`、`成果（每行一项）`；保留技能和标签，移除“原始描述”“量化结果”。
- [ ] `ImportDialog` 保存 AI 草稿时改用同一个 `buildExperienceRawText`，默认标题改为 `导入的经历`；不得再生成 `Responsibility:` / `Achievement:`。
- [ ] AI 草稿中的类型选项通过共享中文标签显示，但 `value` 仍为 `PROJECT` 等英文枚举（共享映射可在中文化计划 Task 1 完成；本计划可先复用当前中文映射）。
- [ ] 运行 `pnpm playwright test tests/e2e/library-onboarding.spec.ts`，预期相关用例通过。
- [ ] 提交：`git commit -m "feat: edit experiences as three structured sections"`。

## Task 4：将右侧经历卡片改为纵向三模块

**Files:**

- Modify: `web/src/app/(app)/library/library-client.tsx`
- Modify: `web/tests/e2e/library-onboarding.spec.ts`
- Modify: `web/tests/e2e/ai-flow.spec.ts`

- [ ] 先添加/更新 E2E 断言：AI 导入后卡片显示“背景”“职责”“成果”，不存在 `Responsibility:` 和 `Achievement:`。
- [ ] 每张卡片仅调用一次 `toExperienceSections(experience)`，按用户确认的 A 方案渲染：背景段落、职责项目符号列表、成果项目符号列表。
- [ ] 空模块不渲染标题；成果不再用旧 `TagRow` 重复展示 `metrics`。
- [ ] 分类计数从 ``${count} blocks`` 改为 ``${count} 项``；保留现有编辑、归档、技能、标签行为。
- [ ] 用 staging 截图中的旧 ResumeAI 示例构造测试数据，确认三条职责和三条成果正确归类且不丢背景。
- [ ] 运行：

```bash
pnpm vitest run tests/unit/experience-sections.test.ts
pnpm playwright test tests/e2e/library-onboarding.spec.ts tests/e2e/ai-flow.spec.ts
```

- [ ] 预期所有定向测试退出码 0。
- [ ] 提交：`git commit -m "feat: render experience cards in three sections"`。

## Task 5：移动端与回归验收

**Files:**

- Modify: `web/tests/e2e/library-layout.spec.ts`
- Modify if needed: `web/src/app/(app)/library/library-client.tsx`

- [ ] 增加 375×812 viewport 用例，创建长背景、职责、成果，断言页面 `scrollWidth <= clientWidth`，三个模块按顺序可见且无横向溢出。
- [ ] 运行完整门禁：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

- [ ] 启动 `pnpm dev`，人工验收新增、编辑、AI 导入和旧数据展示；特别核对不出现 `Responsibility:`、`Achievement:`、`blocks`。
- [ ] 运行 `git diff --check`，确认无空白错误。
- [ ] 对照设计文档第 5–7、10–12 节逐条复核；检查没有 `TODO`、伪代码或占位测试。
- [ ] 使用 `superpowers:requesting-code-review` 完成审查，修复问题后重跑受影响门禁。
- [ ] 最终提交：`git commit -m "test: verify structured experience flow"`。
