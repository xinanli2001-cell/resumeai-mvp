import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { db } from "@/lib/db";
import { logger } from "@/lib/logging/logger";

const DATABASE_CHECK_TIMEOUT_MS = 2000;

async function checkDatabase() {
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("database health check timed out")), DATABASE_CHECK_TIMEOUT_MS),
      ),
    ]);
    return "ok";
  } catch (error) {
    const status = error instanceof Error && error.message === "database health check timed out" ? "timeout" : "error";
    logger.warn("database health check degraded", { error, status });
    return status;
  }
}

export async function GET() {
  try {
    const config = env();
    const database = await checkDatabase();
    return NextResponse.json({ status: "ok", appEnv: config.APP_ENV, checks: { database } });
  } catch (error) {
    logger.error("health check failed", { error });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
