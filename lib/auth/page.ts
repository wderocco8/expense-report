import { redirect } from "next/navigation";
import { requireSession, AuthRequirements } from "@/lib/auth/require-session";

export async function requirePageAuth(requirements?: AuthRequirements) {
  const result = await requireSession(requirements);

  if (!result.ok) {
    switch (result.failure.type) {
      case "unauthenticated":
        redirect("/sign-in");
      case "banned":
        redirect("/pending-approval");
      case "unauthorized":
        redirect("/unauthorized");
    }
  }

  return result.session;
}
