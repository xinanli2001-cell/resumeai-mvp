import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { env } from "@/lib/config/env";
import { breakdownFreeText, breakdownResumeFile } from "@/lib/import/import-service";
import { getProvider } from "@/lib/llm/provider";
import { assertCanConsume, recordUsage } from "@/lib/quota/quota-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

const ImportRequestSchema = z.object({
  rawText: z.string().min(1),
});

const acceptedResumeMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

function isMultipart(request: Request) {
  return request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data") ?? false;
}

async function parseImportInput(request: Request, maxTextBytes: number, maxFileBytes: number) {
  if (!isMultipart(request)) {
    const parsed = ImportRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return { error: "Invalid import input", status: 400 as const };
    }
    if (new TextEncoder().encode(parsed.data.rawText).length > maxTextBytes) {
      return { error: "Request body too large", status: 413 as const };
    }
    return { kind: "text" as const, rawText: parsed.data.rawText };
  }

  const form = await request.formData();
  const file = form.get("resume");
  if (!(file instanceof File)) {
    return { error: "Resume file is required", status: 400 as const };
  }

  const mimeType = file.type || "application/octet-stream";
  if (!acceptedResumeMimeTypes.has(mimeType)) {
    return { error: "Unsupported resume file type", status: 415 as const };
  }
  if (file.size <= 0) {
    return { error: "Resume file is empty", status: 400 as const };
  }
  if (file.size > maxFileBytes) {
    return { error: "Resume file too large", status: 413 as const };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    kind: "file" as const,
    file: {
      filename: file.name || "resume-upload",
      mimeType,
      dataBase64: bytes.toString("base64"),
    },
  };
}

export async function POST(request: Request) {
  const user = await requireUser();
  const config = env();
  const limit = checkRateLimit(`${user.id}:import`, config.LLM_RATE_LIMIT_PER_MINUTE);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const input = await parseImportInput(request, config.MAX_TEXT_BYTES, config.MAX_RESUME_FILE_BYTES);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  try {
    await assertCanConsume(user.id, 1);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quota exceeded" },
      { status: 402 },
    );
  }

  try {
    const provider = getProvider();
    const draft =
      input.kind === "file"
        ? await breakdownResumeFile(input.file, provider)
        : await breakdownFreeText(input.rawText, provider);
    await recordUsage({ userId: user.id, actionType: "import", costUnits: 1, status: "SUCCESS" });
    return NextResponse.json({ draft });
  } catch (error) {
    await recordUsage({ userId: user.id, actionType: "import", costUnits: 1, status: "FAILED" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 502 },
    );
  }
}
