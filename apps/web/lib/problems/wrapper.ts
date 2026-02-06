import { ProblemDetails } from "@/lib/problems/problemDetails";
import { respondProblem } from "@/lib/http/respond";
import { problem } from "@/lib/problems/problem";

type NextRouteHandler<TContext = unknown> = (
  req: Request,
  ctx: TContext,
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

export function withProblems<TContext = unknown>(
  handler: NextRouteHandler<TContext>,
): NextRouteHandler<TContext> {
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
