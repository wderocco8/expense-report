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
  const [job] = await db
    .select()
    .from(receiptFiles)
    .where(eq(receiptFiles.id, id));

  if (!job) {
    throw new Error("Failed to find receipt file");
  }

  return job;
}
