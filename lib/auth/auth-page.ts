// lib/auth/auth-page.ts
import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function requireActiveUserPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (session.user.banned) {
    redirect("/pending-approval");
  }

  return session.user;
}
