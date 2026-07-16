import { expect, test } from "@playwright/test";

test("library profile fields retain padding inside their panel", async ({ page }) => {
  const email = `library-layout-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("Secret123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);

  const panel = page.getByRole("heading", { name: "基本信息" }).locator("xpath=ancestor::form");
  const targetTitle = page.getByLabel("目标岗位");
  const [panelBox, fieldBox] = await Promise.all([panel.boundingBox(), targetTitle.boundingBox()]);

  expect(panelBox).not.toBeNull();
  expect(fieldBox).not.toBeNull();
  expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width - 16);
});
