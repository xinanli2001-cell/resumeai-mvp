import { expect, test } from "@playwright/test";

test("foundation smoke flow", async ({ page }) => {
  const email = `smoke-${Date.now()}@example.com`;
  const password = "Secret123!";

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.getByLabel("姓名").fill("Smoke User");
  await page.getByLabel("所在地 / 目标城市").fill("Sydney");
  await page.getByLabel("目标岗位").fill("AI Engineer Intern");
  await page.getByLabel("简介").fill("Graduate candidate with NLP and backend project experience.");
  await page.getByLabel("电话").fill("+61 400 000 000");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("签证 / 工作权限").fill("Graduate visa");
  await page.getByLabel("语言能力").fill("English, Mandarin");
  await page.getByRole("button", { name: "保存档案" }).click();
  await expect(page.getByText("个人信息已保存")).toBeVisible();

  await page.getByLabel("类型").selectOption("PROJECT");
  await page.getByLabel("标题").fill("ABSA Project");
  await page.getByLabel("组织 / 学校 / 公司").fill("UNSW");
  await page.getByLabel("角色 / 岗位").fill("Project Lead");
  await page.getByLabel("开始").fill("2025-03");
  await page.getByLabel("结束").fill("2025-05");
  await page.getByLabel("技能").fill("Python, BERT");
  await page.getByLabel("标签").fill("NLP, Machine Learning");
  await page.getByLabel("原始描述").fill("Built an aspect-based sentiment analysis pipeline with evaluation.");
  await page.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("经历已保存")).toBeVisible();
  await expect(page.getByText("ABSA Project")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("姓名")).toHaveValue("Smoke User");
  await expect(page.getByText("ABSA Project")).toBeVisible();

  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email Address").fill("admin@example.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goto("/admin");
  await expect(page.getByText(email)).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("combobox").selectOption("ADMIN");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("用户设置已保存")).toBeVisible();
  await expect(row.getByText("Unlimited usage")).toBeVisible();

  await row.getByRole("combobox").selectOption("USER");
  await row.getByRole("spinbutton").fill("42");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("用户设置已保存")).toBeVisible();
  await expect(row.getByRole("spinbutton")).toHaveValue("42");
});
