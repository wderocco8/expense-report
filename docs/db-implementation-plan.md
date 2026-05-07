# Database Schema Implementation Plan

## Overview

Focused implementation plan for the 2-phase receipt processing database schema changes.

---

## Schema Changes

### 1. New Enum: `receipt_status`

```typescript
export const receiptStatus = pgEnum("receipt_status", [
  "pending",           // Receipt uploaded, waiting for OCR
  "ocr_processing",    // Textract OCR in progress
  "ocr_complete",      // OCR done, waiting for extraction
  "extracting",        // OpenAI extraction in progress
  "complete",          // Processing complete
  "failed",            // Terminal failure (manual retry needed)
]);
```

**Note:** The existing `status` enum is kept for `expenseReportJobs`.

---

### 2. New Table: `ocr_results_table`

Stores Textract OCR output for audit and potential reprocessing.

```typescript
export const ocrResults = pgTable("ocr_results_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  receiptId: uuid("receipt_id")
    .references(() => receiptFiles.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull().default("textract"),
  rawResponse: jsonb("raw_response").notNull(),      // Full Textract API response
  extractedText: text("extracted_text").notNull(),   // Cleaned text for OpenAI
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Relations:**
```typescript
export const ocrResultsRelations = relations(ocrResults, ({ one }) => ({
  receipt: one(receiptFiles, {
    fields: [ocrResults.receiptId],
    references: [receiptFiles.id],
  }),
}));
```

---

### 3. Modified Table: `receipt_files_table`

**Changes:**
- Replace `status` column: `status` enum → `receiptStatus` enum
- Remove: `processedAt` timestamp (replaced by granular timestamps)
- Add new timestamp columns for phase tracking

```typescript
export const receiptFiles = pgTable("receipt_files_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  jobId: uuid("job_id")
    .references(() => expenseReportJobs.id, { onDelete: "cascade" })
    .notNull(),
  s3Key: text("s3_key").notNull(),
  originalFilename: text("original_filename"),
  
  // Changed: new enum with phase-aware states
  status: receiptStatus("status").notNull().default("pending"),
  
  errorMessage: text("error_message"),
  
  // New: Phase tracking timestamps
  ocrStartedAt: timestamp("ocr_started_at"),
  ocrCompletedAt: timestamp("ocr_completed_at"),
  extractionStartedAt: timestamp("extraction_started_at"),
  
  // New: OCR provider for potential multi-provider support
  ocrProvider: text("ocr_provider"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

**Updated Relations:**
```typescript
export const receiptFilesRelations = relations(
  receiptFiles,
  ({ one, many }) => ({
    job: one(expenseReportJobs, {
      fields: [receiptFiles.jobId],
      references: [expenseReportJobs.id],
    }),
    extractedExpenses: many(extractedExpenses),
    ocrResults: many(ocrResults),  // NEW: Link to OCR attempts
  }),
);
```

---

### 4. Modified Table: `extracted_expenses_table`

**Changes:**
- Add optional foreign key to `ocrResults` for audit trail

```typescript
export const extractedExpenses = pgTable(
  "extracted_expenses_table",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    receiptId: uuid("receipt_id")
      .references(() => receiptFiles.id, { onDelete: "cascade" })
      .notNull(),
    
    // NEW: Link to the OCR result that produced this extraction
    ocrResultId: uuid("ocr_result_id")
      .references(() => ocrResults.id, { onDelete: "set null" }),
    
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
```

**Updated Relations:**
```typescript
export const extractedExpensesRelations = relations(
  extractedExpenses,
  ({ one }) => ({
    receipt: one(receiptFiles, {
      fields: [extractedExpenses.receiptId],
      references: [receiptFiles.id],
    }),
    // NEW: Link to OCR result
    ocrResult: one(ocrResults, {
      fields: [extractedExpenses.ocrResultId],
      references: [ocrResults.id],
    }),
  }),
);
```

---

## Type Exports

Add new type exports:

```typescript
// ------------ Type-safe helpers ------------
export type OcrResult = typeof ocrResults.$inferSelect;
export type NewOcrResult = typeof ocrResults.$inferInsert;

// Existing exports remain...
export type ExtractedExpense = typeof extractedExpenses.$inferSelect;
export type NewExtractedExpense = typeof extractedExpenses.$inferInsert;
export type ExpenseReportJob = typeof expenseReportJobs.$inferSelect;
export type NewExpenseReportJob = typeof expenseReportJobs.$inferInsert;
export type ReceiptFile = typeof receiptFiles.$inferSelect;
export type NewReceiptFile = typeof receiptFiles.$inferInsert;
```

---

## Migration Strategy

### Migration 0001: Add receipt_status enum

```sql
-- Create new enum for receipt phases
CREATE TYPE receipt_status AS ENUM (
  'pending',
  'ocr_processing',
  'ocr_complete',
  'extracting',
  'complete',
  'failed'
);
```

### Migration 0002: Create ocr_results table

```sql
CREATE TABLE ocr_results_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipt_files_table(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'textract',
    raw_response JSONB NOT NULL,
    extracted_text TEXT NOT NULL,
    confidence DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Migration 0003: Modify receipt_files_table

```sql
-- Add new columns
ALTER TABLE receipt_files_table 
ADD COLUMN ocr_started_at TIMESTAMP,
ADD COLUMN ocr_completed_at TIMESTAMP,
ADD COLUMN extraction_started_at TIMESTAMP,
ADD COLUMN ocr_provider TEXT;

-- Add new status column with new enum (as nullable first)
ALTER TABLE receipt_files_table 
ADD COLUMN new_status receipt_status;

-- Migrate data: map old status to new status
UPDATE receipt_files_table 
SET new_status = CASE 
  WHEN status = 'pending' THEN 'pending'::receipt_status
  WHEN status = 'processing' THEN 'ocr_processing'::receipt_status
  WHEN status = 'complete' THEN 'complete'::receipt_status
  WHEN status = 'failed' THEN 'failed'::receipt_status
END;

-- Drop old status column
ALTER TABLE receipt_files_table 
DROP COLUMN status;

-- Rename new column
ALTER TABLE receipt_files_table 
RENAME COLUMN new_status TO status;

-- Make not null with default
ALTER TABLE receipt_files_table 
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'pending';

-- Drop processed_at (replaced by granular timestamps)
ALTER TABLE receipt_files_table 
DROP COLUMN IF EXISTS processed_at;
```

### Migration 0004: Modify extracted_expenses_table

```sql
-- Add optional OCR result reference
ALTER TABLE extracted_expenses_table 
ADD COLUMN ocr_result_id UUID REFERENCES ocr_results_table(id) ON DELETE SET NULL;
```

---

## Implementation Order

1. **Update schema file** (`packages/db/src/schema/app.schema.ts`)
   - Add `receiptStatus` enum
   - Add `ocrResults` table
   - Modify `receiptFiles` table (new status enum, timestamps)
   - Modify `extractedExpenses` table (add ocrResultId)
   - Update all relations
   - Add new type exports

2. **Generate migration** using Drizzle Kit
   ```bash
   cd packages/db
   pnpm db:generate
   ```

3. **Review migration** - Ensure it matches the manual migrations above

4. **Apply migration** in dev environment
   ```bash
   pnpm db:migrate
   ```

5. **Update repository functions** to handle new columns

6. **Test** - Verify existing data migrates correctly

---

## Receipt Flow with New Schema

```
User uploads receipt(s)
    ↓
Create receiptFiles records (status = "pending")
    ↓
Upload to S3 + send SQS message
    ↓
Lambda picks up message
    ↓
Phase 1 (OCR):
  ├─ Update status → "ocr_processing", ocrStartedAt = now()
  ├─ Call Textract
  ├─ On success:
  │   ├─ Create ocrResults record
  │   ├─ Update receiptFiles: status = "ocr_complete", ocrCompletedAt = now()
  │   └─ Continue to Phase 2
  └─ On failure:
      └─ Update status = "failed", errorMessage = "..."
    ↓
Phase 2 (Extraction):
  ├─ Update status → "extracting", extractionStartedAt = now()
  ├─ Call OpenAI with extractedText from ocrResults
  ├─ On success:
  │   ├─ Create extractedExpenses record (with ocrResultId)
  │   └─ Update receiptFiles: status = "complete"
  └─ On failure:
      └─ Update status = "failed", errorMessage = "..."
```

---

## Rollback Compatibility

The new schema is **backward compatible**:
- Old code using `status` enum still works (values map 1:1 for existing states)
- New columns are nullable or have defaults
- Existing receipts continue to function

---

## Open Questions (Post-Implementation)

1. **OCR retention policy**: How long to keep `ocrResults` records? (consider S3 lifecycle + DB cleanup)
2. **Multiple OCR attempts**: Should we limit retries per receipt? (schema supports multiple records)
3. **OCR provider switching**: The `ocrProvider` column enables future multi-provider support
