import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { db } from "@/lib/db";
import { logger } from "@/lib/logging/logger";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", appEnv: env().APP_ENV });
  } catch (error) {
    logger.error("health check failed", { error });
    return NextResponse.json({ status: "error", appEnv: env().APP_ENV }, { status: 503 });
  }
}
