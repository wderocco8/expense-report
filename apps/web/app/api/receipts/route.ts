import { NextResponse } from "next/server";
import {
  getReceiptFileWithJob,
  deleteReceiptFileWithS3,
  updateReceiptFile,
} from "@/server/services/receipts.service";
import { respondProblem } from "@/lib/http/respond";
import { requireApiAuth } from "@/lib/auth/api";
import { withProblems } from "@/lib/problems/wrapper";
import { AuthProblems } from "@/lib/auth/auth.problems";
import { enqueueReceiptProcessing } from "@/server/services/queue.service";
import { z } from "zod";
import { ConfirmSchema } from "@/app/api/receipts/schema";

export const runtime = "nodejs";

// Confirms upload results: enqueues successful receipts and immediately marks failed ones.
export const POST = withProblems(async (req) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const body = await req.json();
  const { successReceiptIds, failedReceiptIds } = ConfirmSchema.parse(body);

  const userId = authResult.session.user.id;

  const results = await Promise.allSettled([
    ...successReceiptIds.map(async (id) => {
      const receipt = await getReceiptFileWithJob(id);
      if (receipt.job.userId !== userId) throw AuthProblems.unauthorized();
      await enqueueReceiptProcessing(id);
    }),
    ...failedReceiptIds.map(async (id) => {
      const receipt = await getReceiptFileWithJob(id);
      if (receipt.job.userId !== userId) throw AuthProblems.unauthorized();
      await updateReceiptFile(id, {
        status: "failed",
        errorMessage: "S3 upload failed",
      });
    }),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Failed to confirm receipt at index ${i}:`, result.reason);
    }
  });

  return NextResponse.json({ success: true });
});

export const DELETE = withProblems(async (req) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) {
    return respondProblem(authResult.problem);
  }

  const body = await req.json();
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1) }).parse(body);

  const deleted: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    ids.map(async (id) => {
      try {
        const receipt = await getReceiptFileWithJob(id);
        if (receipt.job.userId !== authResult.session.user.id) {
          failed.push(id);
          return;
        }
        await deleteReceiptFileWithS3(id);
        deleted.push(id);
      } catch {
        failed.push(id);
      }
    }),
  );

  return NextResponse.json({ deleted, failed });
});
