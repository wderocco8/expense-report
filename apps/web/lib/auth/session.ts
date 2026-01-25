import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { cache } from "react";

/**
 * Fetches the session and memoizes the result for the duration of a single request.
 * This prevents redundant database hits when multiple components (Layout, Page, Metadata)
 * all need user information.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export type AuthSession = Awaited<ReturnType<typeof getSession>>;
export type AuthUser = NonNullable<AuthSession>["user"];
