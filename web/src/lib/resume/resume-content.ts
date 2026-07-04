import { z } from "zod";

export const ResumeItemSchema = z.object({
  id: z.string(),
  heading: z.string().default(""),
  subheading: z.string().default(""),
  dateRange: z.string().default(""),
  body: z.string().default(""),
  sourceRewrittenId: z.string().optional(),
});

export const ResumeSectionSchema = z.object({
  id: z.string(),
  type: z.enum(["SUMMARY", "EDUCATION", "PROJECT", "INTERNSHIP", "WORK", "SKILL", "CUSTOM"]),
  title: z.string(),
  visible: z.boolean().default(true),
  items: z.array(ResumeItemSchema).default([]),
});

export const ResumeHeaderSchema = z.object({
  name: z.string().default(""),
  targetTitle: z.string().default(""),
  location: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  website: z.string().default(""),
});

export const ResumeContentSchema = z.object({
  header: ResumeHeaderSchema,
  sections: z.array(ResumeSectionSchema).default([]),
});

export type ResumeContent = z.infer<typeof ResumeContentSchema>;
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;
