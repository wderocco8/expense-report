import {
  NewReceiptFile,
  ReceiptFile,
  receiptFiles,
} from "@/server/db/schema/app.schema";
import { db } from "@/server/db/client";
import { eq } from "drizzle-orm";
import { ReceiptFileUpdateInput } from "@/server/validators/receipt.zod";

export async function createReceiptFile(
  data: NewReceiptFile,
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

export async function getReceiptFileWithJob(id: string) {
  const receiptFile = await db.query.receiptFiles.findFirst({
    where: eq(receiptFiles.id, id),
    with: { job: true },
  });

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

export async function updateReceiptFile(
  id: string,
  data: ReceiptFileUpdateInput,
): Promise<ReceiptFile> {
  const [receipt] = await db
    .update(receiptFiles)
    .set({ ...data })
    .where(eq(receiptFiles.id, id))
    .returning();

  if (!receipt) {
    throw new Error("Failed to update receipt file");
  }

  return receipt;
}

export async function deleteReceiptFile(id: string): Promise<ReceiptFile> {
  const [deleted] = await db
    .delete(receiptFiles)
    .where(eq(receiptFiles.id, id))
    .returning();

  if (!deleted) {
    throw new Error("Failed to delete receipt file");
  }

  return deleted;
}
