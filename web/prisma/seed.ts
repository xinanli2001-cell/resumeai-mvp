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
}

main()
  .then(async () => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
