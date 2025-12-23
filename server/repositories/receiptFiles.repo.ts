import { NewReceiptFile, ReceiptFile, receiptFiles } from "@/server/db/schema";
import { db } from "@/server/db/client";
import { eq } from "drizzle-orm";

export async function createReceiptFile(
  data: NewReceiptFile
): Promise<ReceiptFile> {
  const [receiptFile] = await db.insert(receiptFiles).values(data).returning();

  if (!receiptFile) {
    throw new Error("Failed to create receipt file");
  }

  return receiptFile;
}

export async function getReceiptFile(id: string): Promise<ReceiptFile> {
  const [receiptFile] = await db
    .select()
    .from(receiptFiles)
    .where(eq(receiptFiles.id, id));

  if (!receiptFile) {
    throw new Error("Failed to find receipt file");
  }

  return receiptFile;
}

export async function getReceiptFileWithExpense(id: string) {
  const receiptFile = await db.query.receiptFiles.findFirst({
    where: eq(receiptFiles.id, id),
    with: {
      extractedExpenses: true,
    },
  });

  if (!receiptFile) {
    throw new Error("Failed to find receipt file with expense");
  }

  return receiptFile;
}
