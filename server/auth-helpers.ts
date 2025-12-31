// server/auth-helpers.ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db/client";

export async function requireAppUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error("UNAUTHENTICATED");

  const appUser = await db.query.appUser.findFirst({
    where: (u, { eq }) => eq(u.authUserId, session.user.id),
  });

  if (!appUser) throw new Error("APP_USER_MISSING");
  if (appUser.status !== "active") throw new Error("USER_NOT_APPROVED");

  return { session, appUser };
}
