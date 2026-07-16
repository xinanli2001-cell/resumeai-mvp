import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    appEnv: process.env.APP_ENV ?? "unknown",
    runtime: "node",
  });
}
