import { requireSession, AuthRequirements } from "@/lib/auth/require-session";
import { getSession } from "@/lib/auth/session";
import { ProblemDetails } from "@/lib/http/problem";
import { AuthProblems } from "@/lib/auth/auth.problems";

export type ApiAuthResult =
  | {
      ok: true;
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
    }
  | {
      ok: false;
      problem: ProblemDetails;
    };

/**
 * Authenticates an API request and returns RFC 7807 Problem Details on failure.
 * @see {@link requireSession} for the core validation logic.
 * @returns An `ApiAuthResult`.
 */
export async function requireApiAuth(
  requirements?: AuthRequirements
): Promise<ApiAuthResult> {
  const result = await requireSession(requirements);

  if (!result.ok) {
    switch (result.failure.type) {
      case "unauthenticated":
        return { ok: false, problem: AuthProblems.unauthenticated() };
      case "banned":
        return { ok: false, problem: AuthProblems.banned() };
      case "unauthorized":
        return { ok: false, problem: AuthProblems.unauthorized() };
    }
  }

  return { ok: true, session: result.session } as const;
}
