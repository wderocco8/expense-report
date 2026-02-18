import { NewReceiptFile, ReceiptFile, receiptFiles } from "../schema";
import { db } from "../client";
import { eq, asc, desc, like, and, sql, SQL } from "drizzle-orm";
import { ReceiptFileUpdateInput } from "@repo/shared";

export type ReceiptFileSortableField =
  | "originalFilename"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "processedAt";
export type ReceiptFileFilterableField = "originalFilename" | "status";

export interface GetReceiptFilesParams {
  jobId: string;
  sort?: { field: ReceiptFileSortableField; direction: "asc" | "desc" }[];
  filter?: { field: ReceiptFileFilterableField; value: string }[];
  page?: number;
  limit?: number;
}

export interface PaginatedReceiptFiles {
  data: ReceiptFile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function createReceiptFile(
  data: NewReceiptFile,
): Promise<ReceiptFile> {
  const [receiptFile] = await db.insert(receiptFiles).values(data).returning();
  return receiptFile;
}

export async function getReceiptFile(id: string): Promise<ReceiptFile> {
  const [receiptFile] = await db
    .select()
    .from(receiptFiles)
    .where(eq(receiptFiles.id, id));

  return receiptFile;
}

export async function getReceiptFileWithJob(id: string) {
  const receiptFile = await db.query.receiptFiles.findFirst({
    where: eq(receiptFiles.id, id),
    with: { job: true },
  });

  return receiptFile;
}

export async function getReceiptFileWithExpense(id: string) {
  const receiptFile = await db.query.receiptFiles.findFirst({
    where: eq(receiptFiles.id, id),
    with: {
      extractedExpenses: true,
    },
  });

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

  return receipt;
}

export async function deleteReceiptFile(id: string): Promise<ReceiptFile> {
  const [deleted] = await db
    .delete(receiptFiles)
    .where(eq(receiptFiles.id, id))
    .returning();

  return deleted;
}

export async function getReceiptFilesByJobId({
  jobId,
  sort,
  filter,
  page = 1,
  limit = 10,
}: GetReceiptFilesParams): Promise<PaginatedReceiptFiles> {
  const conditions: SQL<unknown>[] = [eq(receiptFiles.jobId, jobId)];

  if (filter?.length) {
    for (const f of filter) {
      if (f.field === "originalFilename") {
        conditions.push(like(receiptFiles.originalFilename, `%${f.value}%`));
      }

      if (f.field === "status") {
        conditions.push(
          eq(
            receiptFiles.status,
            f.value as "pending" | "processing" | "complete" | "failed",
          ),
        );
      }
    }
  }

  const whereClause = and(...conditions)!;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(receiptFiles)
    .where(whereClause);

  const total = Number(countResult?.count ?? 0);
  const offset = (page - 1) * limit;

  let orderByClause: any[] = [];
  if (sort && sort.length > 0) {
    orderByClause = sort.map((s) => {
      const column = receiptFiles[s.field];
      return s.direction === "asc" ? asc(column) : desc(column);
    });
  } else {
    orderByClause = [desc(receiptFiles.createdAt)];
  }

  const data = await db
    .select()
    .from(receiptFiles)
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
