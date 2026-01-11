import { getSession } from "@/lib/auth/session";

export type AuthFailure =
  | { type: "unauthenticated" }
  | { type: "banned" }
  | { type: "unauthorized" };

export interface AuthRequirements {
  role?: "admin" | "member";
  active?: boolean;
}

export type AuthResult =
  | {
      ok: true;
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
    }
  | {
      ok: false;
      failure: { type: "unauthenticated" | "banned" | "unauthorized" };
    };

export async function requireSession(
  requirements: AuthRequirements = {}
): Promise<AuthResult> {
  const session = await getSession();

  if (!session?.user) {
    return { ok: false, failure: { type: "unauthenticated" } as const };
  }

  if (requirements.active && session.user.banned) {
    return { ok: false, failure: { type: "banned" } as const };
  }

  if (requirements.role && session.user.role !== requirements.role) {
    return { ok: false, failure: { type: "unauthorized" } as const };
  }

  return { ok: true, session } as const;
}
