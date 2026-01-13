import { requireApiAuth } from "@/lib/auth/api";
import { AuthProblems } from "@/lib/auth/auth.problems";
import { respondProblem } from "@/lib/http/respond";
import { getReceiptFileWithJob } from "@/server/services/receipts.service";
import { getSignedReceiptUrl } from "@/server/services/storage.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireApiAuth();
    if (!authResult.ok) return respondProblem(authResult.problem);

    const { id } = ParamsSchema.parse(await params);

    const receipt = await getReceiptFileWithJob(id);

    if (receipt.job.userId !== authResult.session.user.id) {
      return respondProblem(AuthProblems.unauthorized());
    }

    const url = await getSignedReceiptUrl(receipt.s3Key);

    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    console.error("Failed to get receipt image", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
