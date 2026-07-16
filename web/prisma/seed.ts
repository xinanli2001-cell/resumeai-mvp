import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", quotaLimit: 999999, passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      quotaLimit: 999999,
      profile: { create: { name: "Admin", contactEmail: adminEmail, languages: [] } },
    },
  });

  await db.user.upsert({
    where: { email: "student@example.com" },
    update: {},
    create: {
      email: "student@example.com",
      passwordHash: await bcrypt.hash("Student123!", 12),
      quotaLimit: 20,
      profile: {
        create: {
          name: "Demo Student",
          location: "Sydney",
          targetTitle: "AI Engineer Intern",
          contactEmail: "student@example.com",
          languages: ["English", "Mandarin"],
        },
      },
      experiences: {
        create: [
          {
            type: "PROJECT",
            title: "Aspect-Based Sentiment Analysis",
            role: "Project Lead",
            rawText:
              "Built ABSA workflow with data cleaning, model evaluation, and error analysis.",
            structuredFields: {},
            skills: ["Python", "BERT", "RoBERTa"],
            tags: ["NLP", "Machine Learning"],
            metrics: [],
          },
        ],
      },
    },
  });

  await db.template.upsert({
    where: { id: "system-zh-compact" },
    update: {
      name: "中文紧凑",
      ownerUserId: null,
      baseTemplateId: null,
      isSystem: true,
      config: {
        sectionOrder: ["SUMMARY", "EDUCATION", "PROJECT", "INTERNSHIP", "WORK", "SKILL"],
        font: { family: "system-ui", sizePt: 10.5 },
        spacing: { sectionGap: 12, lineHeight: 1.35 },
        color: { primary: "#004ac6", text: "#0b1c30" },
        heading: { style: "bar", uppercase: false },
        header: { align: "left", showContactIcons: false },
      },
    },
    create: {
      id: "system-zh-compact",
      name: "中文紧凑",
      ownerUserId: null,
      baseTemplateId: null,
      isSystem: true,
      config: {
        sectionOrder: ["SUMMARY", "EDUCATION", "PROJECT", "INTERNSHIP", "WORK", "SKILL"],
        font: { family: "system-ui", sizePt: 10.5 },
        spacing: { sectionGap: 12, lineHeight: 1.35 },
        color: { primary: "#004ac6", text: "#0b1c30" },
        heading: { style: "bar", uppercase: false },
        header: { align: "left", showContactIcons: false },
      },
    },
  });

  await db.template.upsert({
    where: { id: "system-en-classic" },
    update: {
      name: "English Classic",
      ownerUserId: null,
      baseTemplateId: null,
      isSystem: true,
      config: {
        sectionOrder: ["SUMMARY", "EDUCATION", "WORK", "INTERNSHIP", "PROJECT", "SKILL"],
        font: { family: "Georgia", sizePt: 11 },
        spacing: { sectionGap: 16, lineHeight: 1.45 },
        color: { primary: "#004ac6", text: "#0b1c30" },
        heading: { style: "underline", uppercase: false },
        header: { align: "center", showContactIcons: false },
      },
    },
    create: {
      id: "system-en-classic",
      name: "English Classic",
      ownerUserId: null,
      baseTemplateId: null,
      isSystem: true,
      config: {
        sectionOrder: ["SUMMARY", "EDUCATION", "WORK", "INTERNSHIP", "PROJECT", "SKILL"],
        font: { family: "Georgia", sizePt: 11 },
        spacing: { sectionGap: 16, lineHeight: 1.45 },
        color: { primary: "#004ac6", text: "#0b1c30" },
        heading: { style: "underline", uppercase: false },
        header: { align: "center", showContactIcons: false },
      },
    },
  });
}

main()
  .then(async () => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
