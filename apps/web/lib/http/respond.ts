import { NextResponse } from "next/server";
import { ProblemDetails } from "@/lib/http/problem";

export function respondProblem(problem: ProblemDetails) {
  return NextResponse.json(problem, { status: problem.status });
}
