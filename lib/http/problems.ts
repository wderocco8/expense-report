import { ProblemDetails } from "@/lib/http/problem";

export function problem(
  status: number,
  type: string,
  title: string,
  detail?: string,
  instance?: string
): ProblemDetails {
  return { status, type, title, detail, instance };
}
