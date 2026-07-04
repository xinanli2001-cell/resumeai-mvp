import { expect, test } from "@playwright/test";

test("health, security headers, data deletion, and account deletion hardening flow", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const headers = health.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  await expect(health.json()).resolves.toMatchObject({ status: "ok" });

  const email = `hardening-${Date.now()}@example.com`;
  const password = "Secret123!";

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.getByLabel("姓名").fill("Hardening User");
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "保存档案" }).click();
  await expect(page.getByText("个人信息已保存")).toBeVisible();

  await page.getByLabel("类型").selectOption("PROJECT");
  await page.getByLabel("标题").fill("Private Hardening Project");
  await page.getByLabel("原始描述").fill("Private text that should be deleted.");
  await page.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("Private Hardening Project")).toBeVisible();

  await page.goto("/settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除我的资料数据" }).click();
  await expect(page.getByText("资料数据已删除")).toBeVisible();

  await page.goto("/library");
  await expect(page.getByLabel("姓名")).toHaveValue("");
  await expect(page.getByText("Private Hardening Project")).toHaveCount(0);

  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.goto("/settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "注销账号" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/library");
  await expect(page).toHaveURL(/\/login$/);
});
