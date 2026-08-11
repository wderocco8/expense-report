import { NextResponse } from "next/server";
import { SchemaCreateSchema } from "@repo/shared";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { createSchema, getSchemas } from "@/server/services/schemas.service";

export const POST = withProblems(async (req) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const body = await req.json().catch(() => ({}));

  const parsed = SchemaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const job = await createSchema({
    userId: authResult.session.user.id,
    ...parsed.data,
  });

  return NextResponse.json(job, { status: 201 });
});

export const GET = withProblems(async () => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const jobs = await getSchemas(authResult.session.user.id);

  return NextResponse.json(jobs, { status: 200 });
});
