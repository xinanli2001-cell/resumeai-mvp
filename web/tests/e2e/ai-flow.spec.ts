import { expect, test } from "@playwright/test";

test("mock ai import to rewrite confirmation flow", async ({ page }) => {
  const email = `ai-${Date.now()}@example.com`;
  const password = "Secret123!";

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.getByRole("button", { name: "直接进入完整资料库" }).click();

  await page.getByRole("button", { name: "粘贴文本导入" }).click();
  await page
    .getByLabel("原始经历文本")
    .fill("ABSA Project\nBuilt a BERT sentiment analysis pipeline with Python and NLP evaluation.");
  await page.getByRole("button", { name: "AI 拆解" }).click();
  await expect(page.getByText("待确认")).toBeVisible();
  await page.getByRole("textbox", { name: "组织", exact: true }).fill("UNSW");
  await page.getByRole("button", { name: "保存到信息库" }).click();
  await expect(page.getByText("导入经历已保存")).toBeVisible();
  await expect(page.getByRole("heading", { name: "ABSA Project" })).toBeVisible();

  await page.getByLabel("类型").selectOption("PROJECT");
  await page.getByLabel("标题").fill("Campus Operations");
  await page.getByLabel("组织 / 学校 / 公司").fill("Student Society");
  await page.getByLabel("技能").fill("Communication");
  await page.getByLabel("标签").fill("Operations");
  await page.getByLabel("原始描述").fill("Organized student events and wrote weekly newsletters.");
  await page.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("经历已保存")).toBeVisible();

  await page.goto("/match");
  await page
    .getByPlaceholder("Paste the target job description...")
    .fill("ML Intern\nBuild Python NLP systems with BERT and model evaluation.");
  await page.getByRole("button", { name: "解析并匹配" }).click();
  await expect(page.getByText(/Matched skills:/)).toBeVisible();
  await expect(page.getByText("Campus Operations")).toBeVisible();
  await page.getByRole("combobox").selectOption("BILINGUAL");
  await page.getByLabel(/Campus Operations/).check();
  await page.getByRole("button", { name: /生成改写/ }).click();
  await expect(page).toHaveURL(/\/rewrite\/.+/);

  await expect(page.getByRole("heading", { name: "AI 原始建议" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "进入简历编辑" })).toBeDisabled();
  await page.getByRole("button", { name: "确认" }).first().click();
  await expect(page.getByText("确认状态已保存")).toBeVisible();
  await expect(page.getByRole("button", { name: "进入简历编辑" })).toBeEnabled();
  await page.getByRole("button", { name: "拒绝" }).nth(1).click();
  await expect(page.getByText("REJECTED")).toBeVisible();
});
