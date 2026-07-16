import { expect, test } from "@playwright/test";

test("resume print route renders chrome-free A4 content and produces a PDF", async ({ page }) => {
  const email = `pdf-${Date.now()}@example.com`;
  const password = "Secret123!";

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.getByRole("button", { name: "直接进入完整资料库" }).click();

  await page.getByLabel("姓名").fill("PDF Export User");
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

  await page.goto("/match");
  await page
    .getByPlaceholder("Paste the target job description...")
    .fill("ML Intern\nBuild Python NLP systems, evaluation dashboards, and explain model behavior.");
  await page.getByRole("button", { name: "解析并匹配" }).click();
  await expect(page.getByText("ABSA Project")).toBeVisible();
  await page.getByRole("button", { name: /生成改写/ }).click();
  await expect(page).toHaveURL(/\/rewrite\/.+/);

  await page.getByRole("button", { name: "确认" }).first().click();
  await expect(page.getByText("确认状态已保存")).toBeVisible();
  await expect(page.getByRole("button", { name: "进入简历编辑" })).toBeEnabled();
  await page.getByRole("button", { name: "进入简历编辑" }).click();
  await expect(page).toHaveURL(/\/resume\/.+/);

  const match = page.url().match(/\/resume\/([^/?#]+)/);
  expect(match).not.toBeNull();
  const resumeId = match![1];

  await page.goto(`/resume/${resumeId}/print`);
  await expect(page.getByText("PDF Export User")).toBeVisible();
  await expect(page.getByRole("heading", { name: "ABSA Project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打印 / 保存为 PDF" })).toBeVisible();
  await expect(page.getByText("Pro Workspace")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "信息库" })).toHaveCount(0);

  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.length).toBeGreaterThan(1_000);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});
