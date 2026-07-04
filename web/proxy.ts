import { NextResponse, type NextRequest } from "next/server";
import { withSecurityHeaders } from "@/lib/security/headers";

export function proxy(_request: NextRequest) {
  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
