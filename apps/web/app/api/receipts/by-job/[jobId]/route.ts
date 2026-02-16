import { requireApiAuth } from "@/lib/auth/api";
import { AuthProblems } from "@/lib/auth/auth.problems";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { getReceiptFilesByJobId, getExpenseReportJob } from "@repo/db";
import { NextResponse } from "next/server";
import { problem } from "@/lib/problems/problem";
import { z } from "zod";
import { expenseReportJobProblems } from "@/lib/problems/domain/expenseReportJob";

type RouteCtx = {
  params: Promise<{ jobId: string }>;
};

const GetReceiptFilesSchema = z.object({
  sort: z
    .array(
      z.object({
        field: z.enum([
          "originalFilename",
          "status",
          "createdAt",
          "updatedAt",
          "processedAt",
        ]),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .optional(),
  filter: z
    .array(
      z.object({
        field: z.enum(["originalFilename", "status"]),
        value: z.string(),
      }),
    )
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const GET = withProblems<RouteCtx>(async (req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) {
    return respondProblem(authResult.problem);
  }

  const jobId = z.uuid().parse((await params).jobId);

  const job = await getExpenseReportJob(jobId, authResult.session.user.id);

  if (!job) {
    throw expenseReportJobProblems.notFoundById(jobId);
  }

  // TODO: decide if we want to offload this to the repo
  if (job.userId !== authResult.session.user.id) {
    return respondProblem(AuthProblems.unauthorized());
  }

  const url = new URL(req.url);
  const searchParams = {
    sort: url.searchParams.get("sort"),
    filter: url.searchParams.get("filter"),
    page: url.searchParams.get("page"),
    limit: url.searchParams.get("limit"),
  };

  const parsed = GetReceiptFilesSchema.safeParse({
    sort: searchParams.sort ? JSON.parse(searchParams.sort) : undefined,
    filter: searchParams.filter ? JSON.parse(searchParams.filter) : undefined,
    page: searchParams.page,
    limit: searchParams.limit,
  });

  if (!parsed.success) {
    return respondProblem(
      problem(400, "invalid-parameters", "Invalid query parameters"),
    );
  }

  const result = await getReceiptFilesByJobId({
    jobId: jobId,
    ...parsed.data,
  });

  return NextResponse.json(result);
});
