import { requireApiAuth } from "@/lib/auth/api";
import { AuthProblems } from "@/lib/auth/auth.problems";
import { respondProblem } from "@/lib/http/respond";
import {
  deleteReceiptFileWithS3,
  getReceiptFileWithJob,
} from "@/server/services/receipts.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.uuid(),
});

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireApiAuth();
    if (!authResult.ok) {
      return respondProblem(authResult.problem);
    }

    const { id } = ParamsSchema.parse(await params);

    const receipt = await getReceiptFileWithJob(id);

    if (receipt.job.userId !== authResult.session.user.id) {
      return respondProblem(AuthProblems.unauthorized());
    }

    await deleteReceiptFileWithS3(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete receipt", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
