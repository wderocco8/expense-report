import { requireSession, AuthRequirements } from "@/lib/auth/require-session";
import { getSession } from "@/lib/auth/session";

const statusByFailure = {
  unauthenticated: 401,
  banned: 403,
  unauthorized: 403,
} as const;

export type ApiAuthResult =
  | {
      ok: true;
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      reason: "unauthenticated" | "banned" | "unauthorized";
    };

export async function requireApiAuth(
  requirements?: AuthRequirements
): Promise<ApiAuthResult> {
  const result = await requireSession(requirements);

  if (!result.ok) {
    const reason = result.failure.type;
    return {
      ok: false,
      status: statusByFailure[reason],
      reason: reason,
    };
  }

  return { ok: true, session: result.session } as const;
}
