import { expect, test } from "@playwright/test";

async function registerFreshUser(page: import("@playwright/test").Page, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("Secret123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);
}

test("fresh users can start from profile details and do not see onboarding after saving", async ({ page }) => {
  await registerFreshUser(page, "onboarding-profile");

  await expect(page.getByRole("heading", { name: "开始整理你的求职材料" })).toBeVisible();
  await expect(page.getByRole("button", { name: "粘贴已有简历" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加第一段经历" })).toBeVisible();
  await expect(page.getByRole("button", { name: "从基本信息开始" })).toBeVisible();

  await page.getByRole("button", { name: "从基本信息开始" }).click();
  await expect(page.getByRole("heading", { name: "基本信息" })).toBeVisible();
  await expect(page.getByLabel("姓名")).toBeFocused();

  await page.getByLabel("姓名").fill("Onboarding Profile User");
  await page.getByRole("button", { name: "保存档案" }).click();
  await expect(page.getByText("个人信息已保存")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "开始整理你的求职材料" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "基本信息" })).toBeVisible();
});

test("fresh users can add a first experience and bypass onboarding after saving", async ({ page }) => {
  await registerFreshUser(page, "onboarding-experience");

  await page.getByRole("button", { name: "添加第一段经历" }).click();
  await expect(page.getByRole("heading", { name: "新增经历块" })).toBeVisible();
  await expect(page.getByLabel("标题")).toBeFocused();

  await page.getByLabel("标题").fill("First Resume Project");
  await page.getByLabel("原始描述").fill("Built a production-ready student project.");
  await page.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("经历已保存")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "开始整理你的求职材料" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "First Resume Project" })).toBeVisible();
});

test("fresh users can open and abandon the existing import flow", async ({ page }) => {
  await registerFreshUser(page, "onboarding-import");

  await page.getByRole("button", { name: "粘贴已有简历" }).click();
  await expect(page.getByRole("heading", { name: "粘贴文本导入" })).toBeVisible();

  await page.getByRole("button", { name: "放弃" }).click();
  await expect(page.getByRole("heading", { name: "开始整理你的求职材料" })).toBeVisible();
});
