import { NextResponse } from "next/server";
import {
  getReceiptFileWithJob,
  deleteReceiptFileWithS3,
} from "@/server/services/receipts.service";
import { respondProblem } from "@/lib/http/respond";
import { requireApiAuth } from "@/lib/auth/api";
import { withProblems } from "@/lib/problems/wrapper";
import { AuthProblems } from "@/lib/auth/auth.problems";
import { enqueueReceiptProcessing } from "@/server/services/queue.service";
import { z } from "zod";
import { ConfirmSchema } from "@/app/api/receipts/schema";

export const runtime = "nodejs";

// Confirms that files have been uploaded to S3 and enqueues them for processing.
export const POST = withProblems(async (req) => {
  const authResult = await requireApiAuth();
  if (!authResult.ok) return respondProblem(authResult.problem);

  const body = await req.json();
  const { receiptIds } = ConfirmSchema.parse(body);

  await Promise.all(
    receiptIds.map(async (id) => {
      const receipt = await getReceiptFileWithJob(id);
      if (receipt.job.userId !== authResult.session.user.id) {
        throw AuthProblems.unauthorized();
      }
      await enqueueReceiptProcessing(id);
    }),
  );

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
