import {
  createSchemaVersion as repoCreateSchemaVersion,
  getSchemaVersions as repoGetSchemaVersions,
  getSchemaVersion as repoGetSchemaVersion,
  getSchema,
  SchemaVersion,
  type SchemaFieldDefinition,
  type FieldGroup,
} from "@repo/db";
import { schemaProblems } from "@/lib/problems/domain/schema";
import { schemaVersionProblems } from "@/lib/problems/domain/schemaVersion";

export async function createSchemaVersion({
  userId,
  schemaId,
  fields,
  groups,
}: {
  userId: string;
  schemaId: string;
  fields: SchemaFieldDefinition[];
  groups: FieldGroup[];
}): Promise<SchemaVersion> {
  const schema = await getSchema(schemaId, userId);
  if (!schema) {
    throw schemaProblems.notFoundById(schemaId);
  }

  return repoCreateSchemaVersion({ schemaId, fields, groups });
}

export async function getSchemaVersions({
  userId,
  schemaId,
}: {
  userId: string;
  schemaId: string;
}): Promise<SchemaVersion[]> {
  const schema = await getSchema(schemaId, userId);
  if (!schema) {
    throw schemaProblems.notFoundById(schemaId);
  }

  return repoGetSchemaVersions(schemaId);
}

// Ownership isn't a direct column on schema_versions_table — it's checked
// one hop up via the parent schema. Reused as-is by expenseReports.service's
// job-creation ownership check on schemaVersionId.
export async function getSchemaVersion({
  userId,
  versionId,
}: {
  userId: string;
  versionId: string;
}): Promise<SchemaVersion> {
  const version = await repoGetSchemaVersion(versionId);
  if (!version) {
    throw schemaVersionProblems.notFoundById(versionId);
  }

  const schema = await getSchema(version.schemaId, userId);
  if (!schema) {
    // Deliberately the same not-found problem as "doesn't exist" — don't
    // leak whether a version id belongs to someone else's schema.
    throw schemaVersionProblems.notFoundById(versionId);
  }

  return version;
}
