import { z } from "zod";

export const TemplateConfigSchema = z.object({
  sectionOrder: z.array(z.string()).default([]),
  font: z
    .object({
      family: z.string().default("system-ui"),
      sizePt: z.number().default(11),
    })
    .default({ family: "system-ui", sizePt: 11 }),
  spacing: z
    .object({
      sectionGap: z.number().default(16),
      lineHeight: z.number().default(1.4),
    })
    .default({ sectionGap: 16, lineHeight: 1.4 }),
  color: z
    .object({
      primary: z.string().default("#004ac6"),
      text: z.string().default("#0b1c30"),
    })
    .default({ primary: "#004ac6", text: "#0b1c30" }),
  heading: z
    .object({
      style: z.enum(["underline", "bar", "plain"]).default("bar"),
      uppercase: z.boolean().default(false),
    })
    .default({ style: "bar", uppercase: false }),
  header: z
    .object({
      align: z.enum(["left", "center"]).default("left"),
      showContactIcons: z.boolean().default(false),
    })
    .default({ align: "left", showContactIcons: false }),
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;
