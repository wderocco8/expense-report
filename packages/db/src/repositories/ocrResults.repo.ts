import { OcrResult, NewOcrResult, ocrResults } from "../schema";
import { db } from "../client";
import { desc, eq } from "drizzle-orm";

export async function createOcrResult(data: NewOcrResult): Promise<OcrResult> {
  const [ocrResult] = await db.insert(ocrResults).values(data).returning();
  return ocrResult;
}

export async function getOcrResultByReceiptId(
  receiptId: string,
): Promise<OcrResult | undefined> {
  const [ocrResult] = await db
    .select()
    .from(ocrResults)
    .where(eq(ocrResults.receiptId, receiptId))
    .orderBy(desc(ocrResults.createdAt))
    .limit(1);

  return ocrResult;
}
export async function getOcrResultById(
  ocrResultId: string,
): Promise<OcrResult> {
  const [ocrResult] = await db
    .select()
    .from(ocrResults)
    .where(eq(ocrResults.id, ocrResultId));

  return ocrResult;
}
