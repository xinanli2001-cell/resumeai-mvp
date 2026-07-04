import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TemplateConfig, TemplateConfigSchema } from "@/lib/template/template-config";

export async function listTemplates(userId: string) {
  return db.template.findMany({
    where: {
      OR: [{ isSystem: true }, { ownerUserId: userId }],
    },
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getTemplateForUser(userId: string, id: string) {
  const template = await db.template.findFirst({
    where: {
      id,
      OR: [{ isSystem: true }, { ownerUserId: userId }],
    },
  });
  if (!template) throw new Error("Template not found");
  return template;
}

export async function saveAsMyTemplate(
  userId: string,
  input: { name: string; baseTemplateId?: string; config: TemplateConfig },
) {
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required");
  if (input.baseTemplateId) {
    await getTemplateForUser(userId, input.baseTemplateId);
  }

  const config = TemplateConfigSchema.parse(input.config);
  return db.template.create({
    data: {
      ownerUserId: userId,
      name,
      baseTemplateId: input.baseTemplateId,
      config: config as Prisma.InputJsonObject,
      isSystem: false,
    },
  });
}
