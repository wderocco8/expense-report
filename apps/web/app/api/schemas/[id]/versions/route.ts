import { NextResponse } from "next/server";
import { SchemaVersionCreateSchema } from "@repo/shared";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import {
  createSchemaVersion,
  getSchemaVersions,
} from "@/server/services/schemaVersions.service";

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export const POST = withProblems<RouteCtx>(async (req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const schemaId = z.uuid().parse((await params).id);

  const body = await req.json().catch(() => ({}));

  const parsed = SchemaVersionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const version = await createSchemaVersion({
    userId: authResult.session.user.id,
    schemaId,
    ...parsed.data,
  });

  return NextResponse.json(version, { status: 201 });
});

export const GET = withProblems<RouteCtx>(async (_req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const schemaId = z.uuid().parse((await params).id);

  const versions = await getSchemaVersions({
    userId: authResult.session.user.id,
    schemaId,
  });

  return NextResponse.json(versions, { status: 200 });
});
