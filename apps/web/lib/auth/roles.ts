import type { AuthUser } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/require-session";

export function isAdmin(user: AuthUser): boolean {
  return (user.role as UserRole) === "admin";
}
