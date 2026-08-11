import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  date,
  pgEnum,
  jsonb,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "../schema/auth.schema";
import type { SlimOcrResult } from "../types/ocr.types";
import type {
  SchemaFieldDefinition,
  FieldGroup,
  ExtractedFields,
  ConfidenceFlags,
} from "../types/schema.types";

// ------------ Enum definitions ------------

// ------- app user mappings -------
export const appUserStatus = pgEnum("app_user_status", [
  "pending",
  "active",
  "suspended",
]);

export const appUserRole = pgEnum("app_user_role", [
  "owner",
  "admin",
  "member",
]);

// ------- receipt file status mappings (2-phase processing) -------
// pending: Receipt uploaded, waiting for OCR
// ocr_processing: Textract OCR in progress
// ocr_complete: OCR done, waiting for extraction
// extracting: OpenAI extraction in progress
// complete: Processing complete
// needs_review: extraction finished, but a required field is null and/or
//   flagged in confidence_flags; awaits user input (see plan.md Decisions 8-9)
// failed: Terminal failure (manual retry needed)
export const receiptStatus = pgEnum("receipt_status", [
  "pending",
  "ocr_processing",
  "ocr_complete",
  "extracting",
  "complete",
  "needs_review",
  "failed",
]);

// ------------ Table definitions ------------

// ------- Schema configuration (user-scoped; orgs deferred, see plan.md Decision 1) -------

export const schemas = pgTable(
  "schemas_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    // UI convenience only (defaults the job-creation picker to the
    // most-recently-used schema) — not a data-integrity constraint. There
    // is no "active schema" concept; schema choice happens explicitly at
    // job creation.
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("schemas_user_id_idx").on(t.userId)],
);

export const schemaVersions = pgTable(
  "schema_versions_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    schemaId: uuid("schema_id")
      .references(() => schemas.id, { onDelete: "cascade" })
      .notNull(),
    versionNumber: integer("version_number").notNull(),
    fields: jsonb("fields").notNull().$type<SchemaFieldDefinition[]>(),
    groups: jsonb("groups").notNull().default([]).$type<FieldGroup[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("schema_versions_schema_id_idx").on(t.schemaId),
    uniqueIndex("schema_versions_schema_version_unique").on(
      t.schemaId,
      t.versionNumber,
    ),
  ],
);

// ------- Expense report tables -------

export const expenseReportJobs = pgTable(
  "expense_report_jobs_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // Frozen at job creation time from the user's chosen schema's current
    // version. Never changes after creation — every receipt in this job is
    // extracted against this exact version.
    schemaVersionId: uuid("schema_version_id")
      .references(() => schemaVersions.id, { onDelete: "restrict" })
      .notNull(),
    title: text("title").notNull().default("Expense report"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("jobs_user_id_idx").on(t.userId)],
);

export const receiptFiles = pgTable(
  "receipt_files_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    jobId: uuid("job_id")
      .references(() => expenseReportJobs.id, { onDelete: "cascade" })
      .notNull(),
    s3Key: text("s3_key").notNull(),
    originalFilename: text("original_filename"),
    status: receiptStatus("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    // Phase tracking timestamps
    ocrStartedAt: timestamp("ocr_started_at"),
    ocrCompletedAt: timestamp("ocr_completed_at"),
    extractionStartedAt: timestamp("extraction_started_at"),
    extractionCompletedAt: timestamp("extraction_completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("receipt_files_job_id_idx").on(t.jobId),
    index("receipt_files_status_idx").on(t.status),
  ],
);

export const ocrResults = pgTable(
  "ocr_results_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    receiptId: uuid("receipt_id")
      .references(() => receiptFiles.id, { onDelete: "cascade" })
      .notNull(),
    extractedText: jsonb("extracted_text").notNull().$type<SlimOcrResult>(), // slim KV pairs only (summary fields, line items, raw text)
    provider: text("provider"),
    confidence: decimal("confidence", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("ocr_results_receipt_id_idx").on(t.receiptId)],
);

export const extractedExpenses = pgTable(
  "extracted_expenses_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    receiptId: uuid("receipt_id")
      .references(() => receiptFiles.id, {
        onDelete: "cascade",
      })
      .notNull(),
    ocrResultId: uuid("ocr_result_id").references(() => ocrResults.id, {
      onDelete: "set null",
    }),
    // No schema_version_id here — a job locks to one schema_version_id for
    // its entire lifetime, so which version produced this row is always
    // derivable via receiptId -> receiptFiles.jobId -> job.schemaVersionId,
    // with no possibility of drift.
    // System fields — always present, typed for DB-level aggregation/filtering
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    date: date("date"), // nullable: OCR/extraction may not confidently determine a date
    // All user-defined fields, keyed by SchemaFieldDefinition.key — always flat (Decision 6)
    extractedFields: jsonb("extracted_fields")
      .notNull()
      .default({})
      .$type<ExtractedFields>(),
    // Mechanical confidence signals (Decision 9) — flat fieldKey -> reason map
    confidenceFlags: jsonb("confidence_flags")
      .notNull()
      .default({})
      .$type<ConfidenceFlags>(),
    modelVersion: text("model_version").notNull(),
    isCurrent: boolean("is_current").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("uniq_active_receipt")
      .on(t.receiptId)
      .where(sql`${t.isCurrent} = true`),
    index("extracted_expenses_date_idx").on(t.date),
  ],
);

// ------- Usage tracking (DEFERRED — table defined now so no future migration
// is needed, but enforcement isn't built until plan.md Phase 5: Usage
// Limiting. Not wired into the extraction pipeline yet.) -------

export const userUsage = pgTable(
  "user_usage_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    period: date("period").notNull(), // first-of-month, e.g. 2026-07-01
    receiptsProcessed: integer("receipts_processed").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("user_usage_user_period_unique").on(t.userId, t.period)],
);

// ------------ Relations definitions ------------

export const appUsersRelations = relations(users, ({ many }) => ({
  jobs: many(expenseReportJobs),
  schemas: many(schemas),
  usage: many(userUsage),
}));

export const schemasRelations = relations(schemas, ({ one, many }) => ({
  user: one(users, {
    fields: [schemas.userId],
    references: [users.id],
  }),
  versions: many(schemaVersions),
}));

export const schemaVersionsRelations = relations(
  schemaVersions,
  ({ one, many }) => ({
    schema: one(schemas, {
      fields: [schemaVersions.schemaId],
      references: [schemas.id],
    }),
    jobs: many(expenseReportJobs),
  }),
);

export const expenseReportJobsRelations = relations(
  expenseReportJobs,
  ({ one, many }) => ({
    user: one(users, {
      fields: [expenseReportJobs.userId],
      references: [users.id],
    }),
    schemaVersion: one(schemaVersions, {
      fields: [expenseReportJobs.schemaVersionId],
      references: [schemaVersions.id],
    }),
    receiptFiles: many(receiptFiles),
  }),
);

export const receiptFilesRelations = relations(
  receiptFiles,
  ({ one, many }) => ({
    job: one(expenseReportJobs, {
      fields: [receiptFiles.jobId],
      references: [expenseReportJobs.id],
    }),
    extractedExpenses: many(extractedExpenses),
    ocrResults: many(ocrResults),
  }),
);

export const ocrResultsRelations = relations(ocrResults, ({ one }) => ({
  receipt: one(receiptFiles, {
    fields: [ocrResults.receiptId],
    references: [receiptFiles.id],
  }),
}));

export const extractedExpensesRelations = relations(
  extractedExpenses,
  ({ one }) => ({
    receipt: one(receiptFiles, {
      fields: [extractedExpenses.receiptId],
      references: [receiptFiles.id],
    }),
    ocrResult: one(ocrResults, {
      fields: [extractedExpenses.ocrResultId],
      references: [ocrResults.id],
    }),
  }),
);

export const userUsageRelations = relations(userUsage, ({ one }) => ({
  user: one(users, {
    fields: [userUsage.userId],
    references: [users.id],
  }),
}));

// ------------ Type-safe helpers ------------
export type OcrResult = typeof ocrResults.$inferSelect;
export type NewOcrResult = typeof ocrResults.$inferInsert;

export type ExtractedExpense = typeof extractedExpenses.$inferSelect;
export type NewExtractedExpense = typeof extractedExpenses.$inferInsert;

export type ExpenseReportJob = typeof expenseReportJobs.$inferSelect;
export type NewExpenseReportJob = typeof expenseReportJobs.$inferInsert;

export type ReceiptFile = typeof receiptFiles.$inferSelect;
export type NewReceiptFile = typeof receiptFiles.$inferInsert;

export type Schema = typeof schemas.$inferSelect;
export type NewSchema = typeof schemas.$inferInsert;

export type SchemaVersion = typeof schemaVersions.$inferSelect;
export type NewSchemaVersion = typeof schemaVersions.$inferInsert;

export type UserUsage = typeof userUsage.$inferSelect;
export type NewUserUsage = typeof userUsage.$inferInsert;
