import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { getSchemaVersion } from "@/server/services/schemaVersions.service";

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export const GET = withProblems<RouteCtx>(async (_req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const versionId = z.uuid().parse((await params).id);

  const version = await getSchemaVersion({
    userId: authResult.session.user.id,
    versionId,
  });

  return NextResponse.json(version, { status: 200 });
});
