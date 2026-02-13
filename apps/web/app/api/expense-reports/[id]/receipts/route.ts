import { NextResponse } from "next/server";
import { respondProblem } from "@/lib/http/respond";
import { requireApiAuth } from "@/lib/auth/api";
import { withProblems } from "@/lib/problems/wrapper";
import z from "zod";
import { ReceiptFileAddSchema } from "@repo/shared";
import { manualUpload } from "@/server/services/expenseReports.service";

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export const POST = withProblems<RouteCtx>(async (req, { params }) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) {
    return respondProblem(authResult.problem);
  }

  const id = z.uuid().parse((await params).id);
  console.log("[jobs/id/receipts] jobId", id);

  const formData = await req.formData();

  const payloadRaw = formData.get("payload");
  // TODO: replace throw with respondProblem
  if (typeof payloadRaw !== "string") throw new Error("Missing payload");

  const image = formData.get("image");
  if (!(image instanceof File)) throw new Error("Missing image");

  const parsed = ReceiptFileAddSchema.parse({
    payload: JSON.parse(payloadRaw),
    image,
  });

  await manualUpload({
    jobId: id,
    file: image,
    expensePayload: parsed.payload,
  });

  return NextResponse.json({ success: true });
});
