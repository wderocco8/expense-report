import { ProblemDetails } from "@/lib/problems/problem";
import { respondProblem } from "@/lib/http/respond";
import { problem } from "@/lib/problems/problems";
import { AppRouteHandlerRoutes } from "@/.next/dev/types/routes";

type NextRouteHandler<R extends AppRouteHandlerRoutes> = (
  req: Request,
  ctx: RouteContext<R>,
) => Promise<Response>;

function isProblemDetails(err: unknown): err is ProblemDetails {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "title" in err &&
    "type" in err
  );
}

export function withProblems<R extends AppRouteHandlerRoutes>(
  handler: NextRouteHandler<R>,
): NextRouteHandler<R> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (isProblemDetails(err)) {
        return respondProblem(err);
      }

      console.error(err);
      return respondProblem(
        problem(500, "/problems/internal", "Internal Server Error"),
      );
    }
  };
}
