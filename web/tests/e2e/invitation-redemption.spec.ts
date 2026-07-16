import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";

test.afterAll(async () => {
  await db.$disconnect();
});

test("an open-mode user registers with a code and redeems another in Settings", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const registrationCode = `JOIN-${suffix}`;
  const settingsCode = `BONUS-${suffix}`;
  const email = `invitation-${suffix.toLowerCase()}@example.com`;
  await db.invitationCode.createMany({
    data: [
      {
        code: registrationCode,
        label: "E2E registration",
        maxUses: 1,
        bonusQuota: 3,
      },
      {
        code: settingsCode,
        label: "E2E settings",
        maxUses: 1,
        bonusQuota: 5,
      },
    ],
  });

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("Secret123!");
  await page.getByLabel("邀请码").fill(registrationCode.toLowerCase());
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.goto("/settings");
  await expect(page.getByText("当前可用 23 次改写额度")).toBeVisible();
  await page.getByLabel("邀请码").fill(settingsCode.toLowerCase());
  await page.getByRole("button", { name: "兑换邀请码" }).click();
  await expect(page.getByText("邀请码已兑换，当前可用 28 次改写额度")).toBeVisible();

  await page.getByLabel("邀请码").fill(settingsCode);
  await page.getByRole("button", { name: "兑换邀请码" }).click();
  await expect(page.getByText("该邀请码已兑换")).toBeVisible();
  await expect(page.getByText("当前可用 28 次改写额度")).toBeVisible();
});

test("open registration still accepts a user without an invitation code", async ({ page }) => {
  const email = `open-registration-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("Secret123!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/library$/);
});
