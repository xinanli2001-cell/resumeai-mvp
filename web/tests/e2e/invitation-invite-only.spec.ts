import { expect, test } from "@playwright/test";

test("invite-only registration displays and enforces the required code", async ({ page }) => {
  const email = `invite-only-${Date.now()}@example.com`;

  await page.goto("/register");
  const invitationInput = page.getByLabel("邀请码");
  await expect(invitationInput).toHaveAttribute("required", "");
  await expect(page.getByText("当前为内测注册，需要有效邀请码才能创建账号。")).toBeVisible();

  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("Secret123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(invitationInput).toBeFocused();
  await expect(page).toHaveURL(/\/register$/);

  await invitationInput.fill("NOT-A-REAL-CODE");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("邀请码无效或不可用")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});
