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
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "@/server/db/schema/auth.schema";

// ------------ Enum definitions ------------

// ------- status mappings -------
// pending: job created, no files
// processing: at least one file pending or processing
// complete: all files have status=done
// failed: at least one file failed and user didn't retry

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

export const status = pgEnum("status", [
  "pending",
  "processing",
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

// ------------ Table column definitions ------------

export const expenseReportJobs = pgTable("expense_report_jobs_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull().default("Expense report"),
  status: status("status").notNull().default("pending"),
  totalFiles: integer("total_files").notNull().default(0), // number of receipt_files created for job
  processedFiles: integer("processed_files").notNull().default(0), // increment only when a receipt transitions to a terminal state
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
  status: status("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  processedAt: timestamp("processed_at"),
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
  ]
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
  })
);

// ReceiptFiles → Job (many-to-1) and → ExtractedExpenses (1-to-many)
export const receiptFilesRelations = relations(
  receiptFiles,
  ({ one, many }) => ({
    job: one(expenseReportJobs, {
      fields: [receiptFiles.jobId],
      references: [expenseReportJobs.id],
    }),
    extractedExpenses: many(extractedExpenses),
  })
);

// ExtractedExpenses → Job + ReceiptFile
export const extractedExpensesRelations = relations(
  extractedExpenses,
  ({ one }) => ({
    receipt: one(receiptFiles, {
      fields: [extractedExpenses.receiptId],
      references: [receiptFiles.id],
    }),
  })
);

// ------------ Type-safe helpers ------------
export type ExtractedExpense = typeof extractedExpenses.$inferSelect;
export type NewExtractedExpense = typeof extractedExpenses.$inferInsert;

export type ExpenseReportJob = typeof expenseReportJobs.$inferSelect;
export type NewExpenseReportJob = typeof expenseReportJobs.$inferInsert;

export type ReceiptFile = typeof receiptFiles.$inferSelect;
export type NewReceiptFile = typeof receiptFiles.$inferInsert;
