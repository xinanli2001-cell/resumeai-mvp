import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionCookieName, verifySessionValue } from "./session";

export async function currentUser() {
  const cookieStore = await cookies();
  const value = cookieStore.get(sessionCookieName())?.value;
  if (!value) return null;

  try {
    const session = await verifySessionValue(value);
    return db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true, quotaLimit: true, quotaUsed: true },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/library");
  return user;
}
