import { SignJWT, jwtVerify } from "jose";

export type SessionRole = "USER" | "ADMIN";
export type SessionPayload = { userId: string; role: SessionRole };

const SESSION_COOKIE = "resume_session";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export async function signSessionValue(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionValue(value: string): Promise<SessionPayload> {
  const result = await jwtVerify(value, secretKey());
  const userId = result.payload.userId;
  const role = result.payload.role;

  if (typeof userId !== "string" || (role !== "USER" && role !== "ADMIN")) {
    throw new Error("Invalid session payload");
  }

  return { userId, role };
}
