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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "../schema/auth.schema";
import type { SlimOcrResult } from "../types/ocr.types";

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
// failed: Terminal failure (manual retry needed)
export const receiptStatus = pgEnum("receipt_status", [
  "pending",
  "ocr_processing",
  "ocr_complete",
  "extracting",
  "complete",
  "failed",
]);

export const categoryEnum = pgEnum("category", [
  "tolls/parking",
  "hotel",
  "transport",
  "fuel",
  "meals",
  "phone",
  "supplies",
  "misc",
]);

// ------------ Table definitions ------------

export const expenseReportJobs = pgTable("expense_report_jobs_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull().default("Expense report"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const receiptFiles = pgTable("receipt_files_table", {
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
});

export const ocrResults = pgTable("ocr_results_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  receiptId: uuid("receipt_id")
    .references(() => receiptFiles.id, { onDelete: "cascade" })
    .notNull(),
  extractedText: jsonb("extracted_text").notNull().$type<SlimOcrResult>(), // slim KV pairs only (summary fields, line items, raw text)
  provider: text("provider"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
    merchant: text("merchant"),
    description: text("description"),
    date: date("date"),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    category: categoryEnum("category").notNull(),
    transportDetails: jsonb("transport_details").$type<{
      mode: "train" | "car" | "plane" | null;
      mileage: number | null;
    } | null>(),
    rawJson: jsonb("raw_json"),
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
  ],
);

// ------------ Relations definitions ------------

// User → Job (1-to-many)
export const appUsersRelations = relations(users, ({ many }) => ({
  jobs: many(expenseReportJobs),
}));

// Job → ReceiptFiles (1-to-many)
export const expenseReportJobsRelations = relations(
  expenseReportJobs,
  ({ many }) => ({
    receiptFiles: many(receiptFiles),
  }),
);

// ReceiptFiles → Job (many-to-1) and → ExtractedExpenses (1-to-many) and → OcrResults (1-to-many)
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

// OcrResults → ReceiptFile (many-to-1)
export const ocrResultsRelations = relations(ocrResults, ({ one }) => ({
  receipt: one(receiptFiles, {
    fields: [ocrResults.receiptId],
    references: [receiptFiles.id],
  }),
}));

// ExtractedExpenses → ReceiptFile + OcrResult (many-to-1)
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

// ------------ Type-safe helpers ------------
export type OcrResult = typeof ocrResults.$inferSelect;
export type NewOcrResult = typeof ocrResults.$inferInsert;

export type ExtractedExpense = typeof extractedExpenses.$inferSelect;
export type NewExtractedExpense = typeof extractedExpenses.$inferInsert;

export type ExpenseReportJob = typeof expenseReportJobs.$inferSelect;
export type NewExpenseReportJob = typeof expenseReportJobs.$inferInsert;

export type ReceiptFile = typeof receiptFiles.$inferSelect;
export type NewReceiptFile = typeof receiptFiles.$inferInsert;
