import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import {
  getTemplateForUser,
  listTemplates,
  saveAsMyTemplate,
} from "../../src/lib/template/template-service";

describe("template service", () => {
  beforeEach(async () => {
    await db.resume.deleteMany();
    await db.template.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function seedUsersAndTemplates() {
    const firstUser = await db.user.create({
      data: { email: "template-a@example.com", passwordHash: "hash" },
    });
    const secondUser = await db.user.create({
      data: { email: "template-b@example.com", passwordHash: "hash" },
    });
    const systemTemplate = await db.template.create({
      data: {
        id: "system-template",
        name: "System",
        isSystem: true,
        config: { heading: { style: "bar" } },
      },
    });
    const ownedTemplate = await db.template.create({
      data: {
        ownerUserId: firstUser.id,
        name: "Mine",
        baseTemplateId: systemTemplate.id,
        config: { heading: { style: "plain" } },
      },
    });
    const otherTemplate = await db.template.create({
      data: {
        ownerUserId: secondUser.id,
        name: "Other User",
        config: { heading: { style: "underline" } },
      },
    });
    return { firstUser, secondUser, systemTemplate, ownedTemplate, otherTemplate };
  }

  it("lists system templates and the current user's own templates only", async () => {
    const { firstUser, systemTemplate, ownedTemplate, otherTemplate } = await seedUsersAndTemplates();

    const templates = await listTemplates(firstUser.id);
    const ids = templates.map((template) => template.id);

    expect(ids).toContain(systemTemplate.id);
    expect(ids).toContain(ownedTemplate.id);
    expect(ids).not.toContain(otherTemplate.id);
  });

  it("saves a validated config as an owned non-system template", async () => {
    const { firstUser, systemTemplate } = await seedUsersAndTemplates();

    const saved = await saveAsMyTemplate(firstUser.id, {
      name: "My Compact",
      baseTemplateId: systemTemplate.id,
      config: {
        font: { family: "Arial", sizePt: 10.5 },
        spacing: { sectionGap: 10, lineHeight: 1.3 },
        color: { primary: "#111827", text: "#111827" },
        heading: { style: "underline", uppercase: true },
        header: { align: "center", showContactIcons: true },
        sectionOrder: ["PROJECT", "WORK"],
      },
    });

    expect(saved.ownerUserId).toBe(firstUser.id);
    expect(saved.isSystem).toBe(false);
    expect(saved.baseTemplateId).toBe(systemTemplate.id);
    expect(saved.config).toMatchObject({ heading: { style: "underline", uppercase: true } });
  });

  it("allows system and owned templates but rejects another user's template", async () => {
    const { firstUser, systemTemplate, ownedTemplate, otherTemplate } = await seedUsersAndTemplates();

    await expect(getTemplateForUser(firstUser.id, systemTemplate.id)).resolves.toMatchObject({
      id: systemTemplate.id,
    });
    await expect(getTemplateForUser(firstUser.id, ownedTemplate.id)).resolves.toMatchObject({
      id: ownedTemplate.id,
    });
    await expect(getTemplateForUser(firstUser.id, otherTemplate.id)).rejects.toThrow("Template not found");
  });
});
