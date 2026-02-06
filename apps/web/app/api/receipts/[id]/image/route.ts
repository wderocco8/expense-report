import { requireApiAuth } from "@/lib/auth/api";
import { AuthProblems } from "@/lib/auth/auth.problems";
import { respondProblem } from "@/lib/http/respond";
import { withProblems } from "@/lib/problems/wrapper";
import { getReceiptFileWithJob } from "@/server/services/receipts.service";
import { getSignedReceiptUrl } from "@/server/services/storage.service";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export const GET = withProblems<RouteCtx>(async (req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const id = z.uuid().parse((await params).id);

  const receipt = await getReceiptFileWithJob(id);

  if (receipt.job.userId !== authResult.session.user.id) {
    return respondProblem(AuthProblems.unauthorized());
  }

  const url = await getSignedReceiptUrl(receipt.s3Key);

  return NextResponse.json({ url }, { status: 200 });
});
