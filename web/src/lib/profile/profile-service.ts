import { z } from "zod";
import { db } from "@/lib/db";

export const ProfileInputSchema = z.object({
  name: z.string().default(""),
  location: z.string().default(""),
  targetTitle: z.string().default(""),
  summary: z.string().default(""),
  phone: z.string().default(""),
  contactEmail: z.string().email().or(z.literal("")).default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  website: z.string().default(""),
  workAuthorization: z.string().default(""),
  languages: z.array(z.string()).default([]),
});

export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export async function getProfile(userId: string) {
  return db.profile.upsert({
    where: { userId },
    update: {},
    create: { userId, languages: [] },
  });
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const data = ProfileInputSchema.parse(input);
  return db.profile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
