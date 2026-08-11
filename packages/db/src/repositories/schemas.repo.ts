import { db } from "../client";
import { and, eq } from "drizzle-orm";
import { NewSchema, Schema, schemas } from "../schema";

export async function createSchema(data: NewSchema): Promise<Schema> {
  const [schema] = await db.insert(schemas).values(data).returning();
  return schema;
}

export async function getSchemas(userId: string): Promise<Schema[]> {
  return await db.select().from(schemas).where(eq(schemas.userId, userId));
}

export async function getSchema(id: string, userId: string): Promise<Schema> {
  const [schema] = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.id, id), eq(schemas.userId, userId)));

  return schema;
}
