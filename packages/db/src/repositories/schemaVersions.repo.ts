import { db } from "../client";
import { desc, eq, sql } from "drizzle-orm";
import { NewSchemaVersion, SchemaVersion, schemaVersions } from "../schema";

export async function createSchemaVersion(
  data: Pick<NewSchemaVersion, "schemaId" | "fields" | "groups">,
): Promise<SchemaVersion> {
  // TODO: theoretically, doesn't this need to be a db.txn for the two queries below
  // version_number is server-computed, never client-supplied — schema
  // versions are immutable, monotonically increasing snapshots.
  const [{ maxVersion }] = await db
    .select({
      maxVersion: sql<number>`coalesce(max(${schemaVersions.versionNumber}), 0)`,
    })
    .from(schemaVersions)
    .where(eq(schemaVersions.schemaId, data.schemaId));

  const [schemaVersion] = await db
    .insert(schemaVersions)
    .values({ ...data, versionNumber: maxVersion + 1 })
    .returning();

  return schemaVersion;
}

export async function getSchemaVersions(
  schemaId: string,
): Promise<SchemaVersion[]> {
  return await db
    .select()
    .from(schemaVersions)
    .where(eq(schemaVersions.schemaId, schemaId))
    .orderBy(desc(schemaVersions.versionNumber));
}

// No ownership check here by design — this is the lookup packages/services
// (the worker) uses internally with a job's already-frozen schemaVersionId,
// which was already ownership-checked once at job creation. Callers that
// need per-request ownership enforcement (the web routes) layer that on top
// via schemas.repo's getSchema(schemaId, userId) in the service, rather
// than baking a join in here.
export async function getSchemaVersion(
  id: string,
): Promise<SchemaVersion | undefined> {
  const [schemaVersion] = await db
    .select()
    .from(schemaVersions)
    .where(eq(schemaVersions.id, id));

  return schemaVersion;
}
