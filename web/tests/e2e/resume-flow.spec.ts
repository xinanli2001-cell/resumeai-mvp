import { expect, test } from "@playwright/test";

test("rewrite session creates an editable resume that persists template and content changes", async ({ page }) => {
  const email = `resume-${Date.now()}@example.com`;
  const password = "Secret123!";

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.getByRole("button", { name: "直接进入完整资料库" }).click();

  await page.getByLabel("姓名").fill("Resume Flow User");
  await page.getByLabel("目标岗位").fill("ML Intern");
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "保存档案" }).click();
  await expect(page.getByText("个人信息已保存")).toBeVisible();

  await page.getByLabel("类型").selectOption("PROJECT");
  await page.getByLabel("标题").fill("ABSA Project");
  await page.getByLabel("组织 / 学校 / 公司").fill("UNSW");
  await page.getByLabel("角色 / 岗位").fill("Project Lead");
  await page.getByLabel("技能").fill("Python, BERT");
  await page.getByLabel("标签").fill("NLP");
  await page.getByLabel("原始描述").fill("Built a BERT sentiment analysis pipeline with Python and evaluation.");
  await page.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("经历已保存")).toBeVisible();

  await page.getByLabel("类型").selectOption("WORK");
  await page.getByLabel("标题").fill("Analytics Dashboard");
  await page.getByLabel("组织 / 学校 / 公司").fill("Acme");
  await page.getByLabel("角色 / 岗位").fill("Data Intern");
  await page.getByLabel("技能").fill("SQL, Dashboard");
  await page.getByLabel("标签").fill("Analytics");
  await page.getByLabel("原始描述").fill("Built reporting dashboards and investigated weekly metric movement.");
  await page.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("Analytics Dashboard")).toBeVisible();

  await page.goto("/match");
  await page
    .getByPlaceholder("Paste the target job description...")
    .fill("ML Intern\nBuild Python NLP systems, evaluation dashboards, and explain model behavior.");
  await page.getByRole("button", { name: "解析并匹配" }).click();
  await expect(page.getByText("ABSA Project")).toBeVisible();
  await expect(page.getByText("Analytics Dashboard")).toBeVisible();
  const analyticsSelection = page.getByLabel(/Analytics Dashboard/);
  if (!(await analyticsSelection.isChecked())) {
    await analyticsSelection.check();
  }
  await page.getByLabel("语言").selectOption("BILINGUAL");
  await page.getByRole("button", { name: /生成改写/ }).click();
  await expect(page).toHaveURL(/\/rewrite\/.+/);

  await expect(page.getByRole("button", { name: "进入简历编辑" })).toBeDisabled();
  await page.getByRole("button", { name: "确认" }).first().click();
  await expect(page.getByText("确认状态已保存")).toBeVisible();
  await page.getByRole("button", { name: "确认" }).nth(1).click();
  await expect(page.getByRole("button", { name: "进入简历编辑" })).toBeEnabled();
  await page.getByRole("button", { name: "进入简历编辑" }).click();
  await expect(page).toHaveURL(/\/resume\/.+/);

  await expect(page.getByText("信息库内容")).toBeVisible();
  await expect(page.getByRole("tab", { name: "内容" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "样式" })).toBeVisible();
  await expect(page.locator(".resume-document")).toBeVisible();
  await expect(page.getByRole("button", { name: "导出 PDF" })).toBeEnabled();

  const languageControl = page.getByRole("group", { name: "简历语言" });
  await languageControl.getByRole("button", { name: "EN" }).click();
  await expect(languageControl.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("tab", { name: "内容" }).click();
  await page.getByRole("button", { name: "下移" }).first().click();
  await page.getByLabel("显示该模块").nth(1).uncheck();
  const bodyField = page.getByLabel("条目正文").first();
  await bodyField.fill("Undo target bullet.");
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(bodyField).not.toHaveValue("Undo target bullet.");
  await page.getByRole("button", { name: "重做" }).click();
  await expect(bodyField).toHaveValue("Undo target bullet.");
  await bodyField.fill("Persisted resume bullet with measurable impact.");
  await page.getByRole("tab", { name: "样式" }).click();
  await page.getByLabel("当前模板").selectOption("system-en-classic");
  await page.getByLabel("模板名称").fill("E2E Template");
  await page.getByRole("button", { name: "保存为我的模板" }).click();
  await expect(page.getByText("已保存为我的模板")).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("简历已保存")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "内容" }).click();
  await expect(page.getByLabel("条目正文").first()).toHaveValue("Persisted resume bullet with measurable impact.");
  await expect(page.getByLabel("显示该模块").nth(1)).not.toBeChecked();
  await expect(page.getByRole("group", { name: "简历语言" }).getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "样式" }).click();
  await expect(page.getByLabel("当前模板")).toContainText("E2E Template");
});
