import { getSession } from "@/lib/auth/session";

export type AuthResult =
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];
    }
  | { ok: false; status: 401 | 403; reason: "unauthenticated" | "banned" };

export async function requireActiveUserApi(): Promise<AuthResult> {
  const session = await getSession();

  if (!session?.user) {
    return { ok: false, status: 401, reason: "unauthenticated" };
  }

  if (session.user.banned) {
    return { ok: false, status: 403, reason: "banned" };
  }

  return { ok: true, user: session.user };
}
