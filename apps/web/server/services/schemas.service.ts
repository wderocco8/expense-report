import {
  createSchema as repoCreateSchema,
  getSchemas as repoGetschemas,
  Schema,
} from "@repo/db";

export async function createSchema({
  userId,
  name,
  description,
}: {
  userId: string;
  name: string;
  description?: string;
}): Promise<Schema> {
  const job = await repoCreateSchema({
    userId,
    name,
    description,
  });

  return job;
}

export async function getSchemas(userId: string): Promise<Schema[]> {
  return repoGetschemas(userId);
}
