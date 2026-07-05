import { expect, test } from "@playwright/test";

test("editor can add library experiences and custom sections to a saved resume", async ({ page }) => {
  const email = `editor-v1-${Date.now()}@example.com`;
  const password = "Secret123!";

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.getByLabel("姓名").fill("Editor V1 User");
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
  await page.getByLabel("标题").fill("Volunteer Leadership");
  await page.getByLabel("组织 / 学校 / 公司").fill("Student Society");
  await page.getByLabel("角色 / 岗位").fill("Coordinator");
  await page.getByLabel("技能").fill("Communication, Leadership");
  await page.getByLabel("标签").fill("Leadership");
  await page.getByLabel("原始描述").fill("Coordinated volunteer onboarding and weekly event operations.");
  await page.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("Volunteer Leadership")).toBeVisible();

  await page.goto("/match");
  await page
    .getByPlaceholder("Paste the target job description...")
    .fill("ML Intern\nBuild Python NLP systems with BERT and model evaluation.");
  await page.getByRole("button", { name: "解析并匹配" }).click();
  await expect(page.getByText("ABSA Project")).toBeVisible();
  const volunteerSelection = page.getByLabel(/Volunteer Leadership/);
  if (await volunteerSelection.isChecked()) {
    await volunteerSelection.uncheck();
  }
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

  await page.getByRole("button", { name: "加入简历 Volunteer Leadership" }).click();
  await expect(page.getByText("已加入简历：Volunteer Leadership")).toBeVisible();
  await page.getByRole("button", { name: "加入简历 Volunteer Leadership" }).click();
  await expect(page.getByText("该经历已在当前简历中")).toBeVisible();

  await page.getByRole("button", { name: "新增自定义模块" }).click();
  await page.getByLabel("模块标题").last().fill("Awards");
  await page.getByLabel("条目正文").last().fill("Dean's List recognition.");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("简历已保存")).toBeVisible();

  await page.reload();
  await expect(page.locator(".resume-document").getByRole("heading", { name: "Volunteer Leadership" })).toBeVisible();
  await expect(page.getByLabel("模块标题").last()).toHaveValue("Awards");
  await expect(page.getByLabel("条目正文").last()).toHaveValue("Dean's List recognition.");
  await expect(page.getByText(/版面检查：/)).toBeVisible();

  await page.goto(`/resume/${resumeId}/print`);
  await expect(page.getByRole("heading", { name: "Volunteer Leadership" })).toBeVisible();
  await expect(page.getByText("Pro Workspace")).toHaveCount(0);
});
