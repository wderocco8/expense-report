import { getSession } from "@/lib/auth/session";

export type AuthFailure =
  | { type: "unauthenticated" }
  | { type: "banned" }
  | { type: "unauthorized" };

export type UserRole = "admin" | "member";

export interface AuthRequirements {
  /** * List of allowed roles. If omitted, any authenticated role is allowed.
   * @example ["admin", "member"]
   */
  roles?: UserRole[];

  /** * Whether to check if the user is banned.
   * @default true
   */
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

/**
 * Requires an authenticated session and validates it against specified requirements.
 *
 * @param requirements - Authentication requirements to validate against. Defaults to `{ active: true }`.
 * @param requirements.active - If true, checks that the user is not banned.
 * @param requirements.role - If specified, checks that the user's role matches this value.
 *
 * @returns A promise that resolves to an `AuthResult` object:
 *   - `{ ok: true, session }` if the session is valid and meets all requirements
 *   - `{ ok: false, failure: { type: "unauthenticated" } }` if no session or user exists
 *   - `{ ok: false, failure: { type: "banned" } }` if `active` is true and user is banned
 *   - `{ ok: false, failure: { type: "unauthorized" } }` if role requirement is not met
 *
 * @example
 * ```typescript
 * const result = await requireSession({ active: true, role: "admin" });
 * if (result.ok) {
 *   console.log(result.session.user);
 * } else {
 *   console.log(result.failure.type); // "unauthenticated" | "banned" | "unauthorized"
 * }
 * ```
 */
export async function requireSession(
  requirements: AuthRequirements = {}
): Promise<AuthResult> {
  const { active = true, roles } = requirements;

  const session = await getSession();

  if (!session?.user) {
    return { ok: false, failure: { type: "unauthenticated" } as const };
  }

  if (active && session.user.banned) {
    return { ok: false, failure: { type: "banned" } as const };
  }

  if (roles && !roles.includes(session.user.role as UserRole)) {
    return { ok: false, failure: { type: "unauthorized" } as const };
  }

  return { ok: true, session } as const;
}
