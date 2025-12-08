import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  date,
  pgEnum,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

// ------------ Table schema definitions ------------

const status = pgEnum("status", [
  "pending",
  "processing",
  "complete",
  "failed",
]);

export const expenseReportJobsTable = pgTable("expense_report_jobs_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  // userId: uuid("user_id").notNull().defaultRandom(), // TODO
  status: status("status"),
  totalFiles: integer("total_files").notNull().default(0),
  processedFiles: integer("processed_files").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const receiptFilesTable = pgTable("receipt_files_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  jobId: uuid("job_id")
    .references(() => expenseReportJobsTable.id)
    .notNull(),
  s3Url: text("s3_url").notNull(),
  originalFilename: text("original_filename"),
  status: status("status"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

const categoryEnum = pgEnum("category", [
  "tolls/parking",
  "hotel",
  "transport",
  "fuel",
  "meals",
  "phone",
  "supplies",
  "misc",
]);

export const extractedExpensesTable = pgTable("extracted_expenses_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  jobId: uuid("job_id")
    .references(() => expenseReportJobsTable.id)
    .notNull(),
  receiptId: uuid("receipt_id")
    .references(() => receiptFilesTable.id)
    .notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ------------ Relations definitions ------------

// Job → ReceiptFiles (1-to-many)
export const expenseReportJobsRelations = relations(
  expenseReportJobsTable,
  ({ many }) => ({
    receiptFiles: many(receiptFilesTable),
    extractedExpenses: many(extractedExpensesTable),
  })
);

// ReceiptFiles → Job (many-to-1) and → ExtractedExpenses (1-to-many)
export const receiptFilesRelations = relations(
  receiptFilesTable,
  ({ one, many }) => ({
    job: one(expenseReportJobsTable, {
      fields: [receiptFilesTable.jobId],
      references: [expenseReportJobsTable.id],
    }),
    extractedExpenses: many(extractedExpensesTable),
  })
);

// ExtractedExpenses → Job + ReceiptFile
export const extractedExpensesRelations = relations(
  extractedExpensesTable,
  ({ one }) => ({
    job: one(expenseReportJobsTable, {
      fields: [extractedExpensesTable.jobId],
      references: [expenseReportJobsTable.id],
    }),
    receipt: one(receiptFilesTable, {
      fields: [extractedExpensesTable.receiptId],
      references: [receiptFilesTable.id],
    }),
  })
);

// ------------ Type-safe helpers ------------
export type ExtractedExpense = typeof extractedExpensesTable.$inferSelect;
export type NewExtractedExpense = typeof extractedExpensesTable.$inferInsert;

export type ExpenseReportJob = typeof expenseReportJobsTable.$inferSelect;
export type NewExpenseReportJob = typeof expenseReportJobsTable.$inferInsert;

export type ReceiptFile = typeof receiptFilesTable.$inferSelect;
export type NewReceiptFile = typeof receiptFilesTable.$inferInsert;
