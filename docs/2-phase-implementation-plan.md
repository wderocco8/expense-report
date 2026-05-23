# 2-Phase Receipt Processing Implementation Plan

## Overview

Implement a two-phase receipt processing pipeline using **AWS Textract AnalyzeExpense** for OCR (Phase 1) and **OpenAI** for structured extraction (Phase 2).

**Key Benefits:**

- **Cost reduction**: Textract is ~3-5x cheaper than OpenAI vision for OCR
- **Better reliability**: Decoupled phases with independent retry logic
- **Faster processing**: Textract optimized for document text extraction
- **Simpler code**: Textract reads directly from S3 (no base64 encoding)

---

## Prerequisites

### 1. S3 Migration for Local Development

Before implementing 2-phase processing, migrate local development from MinIO to real AWS S3:

#### A. Create Dev S3 Bucket

1. Create bucket `expense-receipts-dev` in AWS Console (region: `us-east-1`)
2. Apply CORS policy:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

3. Keep "Block Public Access" settings **ON**
4. Set Object Ownership to "Bucket owner enforced"

#### B. Create IAM Policy for Dev

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::expense-receipts-dev/*"
    }
  ]
}
```

#### C. Update Local Environment Variables

```bash
# .env.local - REPLACE MinIO config with real S3
S3_REGION="us-east-1"
S3_BUCKET="expense-receipts-dev"
S3_ACCESS_KEY="your-dev-iam-access-key"
S3_SECRET_KEY="your-dev-iam-secret-key"
# REMOVE: S3_ENDPOINT (no longer needed)
```

#### D. Code Changes for S3 Compatibility

Update both storage services to handle optional endpoint:

```typescript
// packages/services/src/storage.service.ts
// apps/web/server/services/storage.service.ts

const s3 = new S3Client({
  region: S3_REGION!,
  endpoint: S3_ENDPOINT || undefined, // undefined for real S3
  forcePathStyle: !!S3_ENDPOINT,      // false for real S3
  credentials: { ... },
});
```

#### E. Cleanup

- Remove MinIO from `docker-compose.yml`
- Update `README.md` (remove MinIO setup instructions)
- Update `next.config.ts` (remove MinIO image hostname if present)

---

## Phase 1: Database Schema Updates

**Status:** ⏳ Pending validation

### OCR Result Storage Strategy

The raw Textract `AnalyzeExpense` response for a single receipt is ~350kb due to geometry/polygon coordinates on every field. These coordinates have no value downstream.

**Decision: Store a slim `extractedText` JSONB object only. No `rawResponse` in DB, no S3 backup.**

The slim object contains:

- `summaryFields` — standard Textract KV pairs (`VENDOR_NAME`, `TOTAL`, `TAX`, etc.) with type, value, and confidence only
- `lineItems` — per-item description, quantity, unit price, total
- `rawText` — all `LINE` blocks from the response concatenated into a plain string

The `rawText` field is the completeness guarantee: even fields Textract couldn't classify into a standard type (unrecognized address formats, taglines, footnotes, etc.) are still captured as readable text and sent to OpenAI. Nothing on the receipt is lost, just the geometry metadata.

**Resulting size: ~1–3kb per receipt vs ~350kb raw.**

### `extractedText` Shape

```typescript
// Stored in ocr_results_table.extracted_text (jsonb)
interface SlimOcrResult {
  summaryFields: Array<{
    type: string; // e.g. "VENDOR_NAME", "TOTAL", "TAX", "OTHER"
    label: string | null; // Actual label as it appears on the document
    value: string;
    confidence: number;
  }>;
  lineItems: Array<{
    description: string | null;
    quantity: string | null;
    unitPrice: string | null;
    total: string | null;
  }>;
  rawText: string; // All LINE blocks joined by \n — completeness guarantee for OpenAI
}
```

### Migration 001: Add Phase Tracking to Receipts

```sql
-- receipt_status enum already defined in schema
-- Add phase tracking timestamps (status column already exists as receiptStatus enum)
ALTER TABLE receipt_files_table
ADD COLUMN ocr_started_at TIMESTAMP,
ADD COLUMN ocr_completed_at TIMESTAMP,
ADD COLUMN extraction_started_at TIMESTAMP,
ADD COLUMN extraction_completed_at TIMESTAMP;

-- Index for efficient phase queries
CREATE INDEX idx_receipt_files_status ON receipt_files_table(status);
```

### Migration 002: Create OCR Results Table

```sql
CREATE TABLE ocr_results_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipt_files_table(id) ON DELETE CASCADE,
    -- rawResponse intentionally omitted: ~350kb of geometry data with no downstream use
    -- rawText (completeness guarantee) lives inside extracted_text.rawText
    extracted_text JSONB NOT NULL,  -- SlimOcrResult shape: summaryFields + lineItems + rawText
    confidence DECIMAL(5,2),        -- Average confidence across summaryFields
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ocr_results_receipt_id ON ocr_results_table(receipt_id);
```

### Migration 003: Backfill Existing Data

```sql
-- Mark all existing completed receipts
UPDATE receipt_files_table
SET status = 'complete'
WHERE status = 'complete'; -- already set, no-op for existing rows

-- Mark failed receipts
UPDATE receipt_files_table
SET status = 'failed'
WHERE status = 'failed';
```

---

## Phase 2: Package Structure Updates

### New Directory Structure

```
packages/
  services/
    src/
      ocr/
        textract.service.ts          # NEW: Textract AnalyzeExpense integration
        ocr.interface.ts             # NEW: OCR service contracts

      extraction/
        openai-extraction.service.ts # NEW: OpenAI structured extraction
        extraction.interface.ts      # NEW: Extraction contracts
        extraction.schema.ts         # NEW: Zod schemas for validation

      orchestration/
        phase1-processor.ts          # NEW: Phase 1 orchestration
        phase2-processor.ts          # NEW: Phase 2 orchestration
        retry.utils.ts               # NEW: Shared retry utilities

      storage.service.ts             # UPDATE: S3 client config
      process.ts                     # UPDATE: New 2-phase flow
      index.ts                       # UPDATE: Export new modules
```

---

## Phase 3: Service Implementations

### 3.1 OCR Service Interface

**File:** `packages/services/src/ocr/ocr.interface.ts`

```typescript
export interface SlimOcrResult {
  summaryFields: Array<{
    type: string;
    label: string | null;
    value: string;
    confidence: number;
  }>;
  lineItems: Array<{
    description: string | null;
    quantity: string | null;
    unitPrice: string | null;
    total: string | null;
  }>;
  rawText: string; // All LINE blocks — completeness guarantee, no geometry
}

export interface OcrResult {
  data: SlimOcrResult | null;
  avgConfidence: number;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface OcrService {
  analyzeExpense(s3Bucket: string, s3Key: string): Promise<OcrResult>;
}
```

### 3.2 Textract Service

**File:** `packages/services/src/ocr/textract.service.ts`

Uses `AnalyzeExpense` (not `DetectDocumentText`) to get pre-structured KV pairs for receipts and invoices. Geometry is stripped before returning — only type, label, value, and confidence are kept.

```typescript
import {
  TextractClient,
  AnalyzeExpenseCommand,
  ExpenseField,
  LineItemFields,
} from "@aws-sdk/client-textract";
import { OcrResult, OcrService, SlimOcrResult } from "./ocr.interface";

const textract = new TextractClient({
  region: process.env.TEXTRACT_REGION || process.env.S3_REGION || "us-east-1",
});

export class TextractService implements OcrService {
  async analyzeExpense(s3Bucket: string, s3Key: string): Promise<OcrResult> {
    try {
      const command = new AnalyzeExpenseCommand({
        Document: {
          S3Object: { Bucket: s3Bucket, Name: s3Key },
        },
      });

      const response = await textract.send(command);
      const doc = response.ExpenseDocuments?.[0];

      if (!doc) {
        return {
          data: null,
          avgConfidence: 0,
          success: false,
          error: "No expense document found in Textract response",
          shouldRetry: false,
        };
      }

      // --- Summary fields (strip geometry) ---
      const summaryFields = (doc.SummaryFields ?? []).map(
        (f: ExpenseField) => ({
          type: f.Type?.Text ?? "OTHER",
          label: f.LabelDetection?.Text ?? null,
          value: f.ValueDetection?.Text ?? "",
          confidence: f.ValueDetection?.Confidence ?? 0,
        }),
      );

      // --- Line items (strip geometry) ---
      const lineItems = (doc.LineItemGroups ?? []).flatMap((group) =>
        (group.LineItems ?? []).map((item) => {
          const fields = Object.fromEntries(
            (item.LineItemExpenseFields ?? []).map((f: LineItemFields) => [
              f.Type?.Text,
              f.ValueDetection?.Text ?? null,
            ]),
          );
          return {
            description: fields["ITEM"] ?? null,
            quantity: fields["QUANTITY"] ?? null,
            unitPrice: fields["UNIT_PRICE"] ?? null,
            total: fields["PRICE"] ?? null,
          };
        }),
      );

      // --- Raw text: all LINE blocks — completeness guarantee ---
      // Captures anything Textract couldn't classify into a standard field
      // (e.g. unrecognised address formats, taglines, footnotes)
      const rawText = (doc.Blocks ?? [])
        .filter((b) => b.BlockType === "LINE")
        .map((b) => b.Text ?? "")
        .join("\n");

      const avgConfidence =
        summaryFields.length > 0
          ? summaryFields.reduce((sum, f) => sum + f.confidence, 0) /
            summaryFields.length
          : 0;

      const slim: SlimOcrResult = { summaryFields, lineItems, rawText };

      return { data: slim, avgConfidence, success: true, shouldRetry: false };
    } catch (error) {
      return {
        data: null,
        avgConfidence: 0,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown Textract error",
        shouldRetry: this.isRetryableError(error),
      };
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      return [
        "ThrottlingException",
        "ProvisionedThroughputExceededException",
        "ServiceUnavailable",
      ].includes(error.name);
    }
    return false;
  }
}

export const textractService = new TextractService();
```

### 3.3 Extraction Service Interface

**File:** `packages/services/src/extraction/extraction.interface.ts`

```typescript
import { ReceiptDTO } from "@repo/shared";
import { SlimOcrResult } from "../ocr/ocr.interface";

export interface ExtractionResult {
  data: ReceiptDTO | null;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface ExtractionService {
  extractFromOcr(ocr: SlimOcrResult): Promise<ExtractionResult>;
}
```

### 3.4 OpenAI Extraction Service

**File:** `packages/services/src/extraction/openai-extraction.service.ts`

Receives the slim OCR result and serialises it into a prompt. The `rawText` is appended after the structured fields so OpenAI has both the pre-parsed KV pairs and the full unclassified text as a fallback.

```typescript
import OpenAI from "openai";
import { ExtractionResult, ExtractionService } from "./extraction.interface";
import { SlimOcrResult } from "../ocr/ocr.interface";
import { ReceiptDTO, ReceiptSchema } from "@repo/shared";
import { ResponseTextConfig } from "openai/resources/responses/responses.mjs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const ReceiptFormat: ResponseTextConfig = {
  format: {
    type: "json_schema",
    name: "receipt",
    strict: true,
    schema: {
      /* ... same schema as before ... */
    },
  },
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

function buildPrompt(ocr: SlimOcrResult): string {
  const fields = ocr.summaryFields
    .map((f) => `${f.type}${f.label ? ` (${f.label})` : ""}: ${f.value}`)
    .join("\n");

  const items = ocr.lineItems
    .map((li, i) =>
      [
        `Item ${i + 1}:`,
        li.description ? `  description: ${li.description}` : null,
        li.quantity ? `  quantity: ${li.quantity}` : null,
        li.unitPrice ? `  unit_price: ${li.unitPrice}` : null,
        li.total ? `  total: ${li.total}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return [
    "## Structured fields (extracted by Textract)",
    fields,
    items ? `\n## Line items\n${items}` : "",
    "\n## Full receipt text (completeness fallback)",
    ocr.rawText,
  ]
    .filter(Boolean)
    .join("\n");
}

export class OpenAIExtractionService implements ExtractionService {
  async extractFromOcr(ocr: SlimOcrResult): Promise<ExtractionResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callOpenAI(ocr);
      } catch (error) {
        lastError = error;
        if (this.isRateLimitError(error) && attempt < MAX_RETRIES) {
          await this.sleep(this.getRetryDelay(attempt));
          continue;
        }
        return {
          data: null,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          shouldRetry: false,
        };
      }
    }

    return {
      data: null,
      success: false,
      error: `Failed after ${MAX_RETRIES} attempts: ${lastError}`,
      shouldRetry: false,
    };
  }

  private async callOpenAI(ocr: SlimOcrResult): Promise<ExtractionResult> {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `Extract structured receipt data from the following Textract output.\n\n${buildPrompt(ocr)}`,
        },
      ],
      text: ReceiptFormat,
    });

    const parsed = ReceiptSchema.safeParse(JSON.parse(response.output_text));

    if (!parsed.success) {
      return {
        data: null,
        success: false,
        error: `Schema validation failed: ${parsed.error.message}`,
        shouldRetry: false,
      };
    }

    return { data: parsed.data, success: true, shouldRetry: false };
  }

  private isRateLimitError(error: unknown): boolean {
    return (
      error instanceof OpenAI.APIError &&
      (error.status === 429 || error.code === "rate_limit_exceeded")
    );
  }

  private getRetryDelay(attempt: number): number {
    return BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const openaiExtractionService = new OpenAIExtractionService();
```

### 3.5 Phase 1 Processor

**File:** `packages/services/src/orchestration/phase1-processor.ts`

```typescript
import { getReceiptFile, updateReceiptFile, createOcrResult } from "@repo/db";
import { textractService } from "../ocr/textract.service";

export async function processPhase1Ocr(receiptId: string): Promise<void> {
  const receipt = await getReceiptFile(receiptId);

  if (["ocr_complete", "complete", "extracting"].includes(receipt.status)) {
    console.log(`[Phase 1] Receipt ${receiptId} already OCR'd, skipping`);
    return;
  }

  await updateReceiptFile(receiptId, {
    status: "ocr_processing",
    ocrStartedAt: new Date(),
  });

  const result = await textractService.analyzeExpense(
    process.env.S3_BUCKET!,
    receipt.s3Key,
  );

  if (!result.success || !result.data) {
    await updateReceiptFile(receiptId, {
      status: "failed",
      errorMessage: `OCR failed: ${result.error}`,
    });
    if (result.shouldRetry) {
      throw new Error(`Textract retryable error: ${result.error}`);
    }
    return;
  }

  await createOcrResult({
    receiptId,
    extractedText: result.data, // slim SlimOcrResult — no geometry
    confidence: result.avgConfidence,
  });

  await updateReceiptFile(receiptId, {
    status: "ocr_complete",
    ocrCompletedAt: new Date(),
  });

  console.log(`[Phase 1] OCR complete for ${receiptId}`);
}
```

### 3.6 Phase 2 Processor

**File:** `packages/services/src/orchestration/phase2-processor.ts`

```typescript
import {
  getReceiptFile,
  getOcrResultByReceiptId,
  updateReceiptFile,
  createExtractedExpense,
} from "@repo/db";
import { openaiExtractionService } from "../extraction/openai-extraction.service";
import { mapReceiptToDb } from "@repo/shared";

export async function processPhase2Extraction(
  receiptId: string,
): Promise<void> {
  const receipt = await getReceiptFile(receiptId);

  if (receipt.status === "complete") {
    console.log(`[Phase 2] Receipt ${receiptId} already complete, skipping`);
    return;
  }

  if (receipt.status !== "ocr_complete") {
    throw new Error(
      `[Phase 2] Receipt ${receiptId} not ready (status: ${receipt.status})`,
    );
  }

  const ocrResult = await getOcrResultByReceiptId(receiptId);

  if (!ocrResult) {
    throw new Error(`[Phase 2] No OCR result found for receipt ${receiptId}`);
  }

  await updateReceiptFile(receiptId, {
    status: "extracting",
    extractionStartedAt: new Date(),
  });

  const result = await openaiExtractionService.extractFromOcr(
    ocrResult.extractedText, // SlimOcrResult — includes rawText as completeness fallback
  );

  if (!result.success) {
    await updateReceiptFile(receiptId, {
      status: "failed",
      errorMessage: `Extraction failed: ${result.error}`,
    });
    if (result.shouldRetry) {
      throw new Error(`Extraction retryable error: ${result.error}`);
    }
    return;
  }

  const dbRecord = mapReceiptToDb(result.data!, receiptId, ocrResult.id);

  try {
    await createExtractedExpense(dbRecord);
  } catch (error) {
    if (isDuplicateError(error)) {
      console.log(
        `[Phase 2] Duplicate extraction for ${receiptId}, skipping insert`,
      );
    } else {
      throw error;
    }
  }

  await updateReceiptFile(receiptId, {
    status: "complete",
    extractionCompletedAt: new Date(),
  });

  console.log(`[Phase 2] Extraction complete for ${receiptId}`);
}

function isDuplicateError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("unique constraint") ||
      error.message.includes("uniq_active_receipt"))
  );
}
```

### 3.7 Updated Main Process

**File:** `packages/services/src/process.ts`

```typescript
import { getReceiptFile } from "@repo/db";
import { processPhase1Ocr } from "./orchestration/phase1-processor";
import { processPhase2Extraction } from "./orchestration/phase2-processor";

export async function processReceipt(receiptId: string): Promise<void> {
  const receipt = await getReceiptFile(receiptId);

  if (receipt.status === "complete") {
    console.log(`[Process] Receipt ${receiptId} already complete`);
    return;
  }

  if (["pending", "failed"].includes(receipt.status)) {
    await processPhase1Ocr(receiptId);

    const updated = await getReceiptFile(receiptId);
    if (updated.status !== "ocr_complete") {
      return; // Phase 1 failed or still processing
    }
  }

  if (["ocr_complete", "extracting"].includes(receipt.status)) {
    await processPhase2Extraction(receiptId);
  }
}
```

---

## Phase 4: CDK Infrastructure Updates

### 4.1 Add Textract IAM Permissions

**File:** `apps/worker/infra/lib/worker-stack.ts`

```typescript
import * as iam from "aws-cdk-lib/aws-iam";

// Add Textract permissions (resource-level not supported by Textract)
receiptProcessor.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ["textract:AnalyzeExpense"],
    resources: ["*"],
  }),
);

// S3 read access so Textract can pull the receipt image
receiptProcessor.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ["s3:GetObject"],
    resources: [`arn:aws:s3:::${process.env.S3_BUCKET}/*`],
  }),
);
```

### 4.2 Update Lambda Environment

```typescript
environment: {
  // ... existing env vars
  TEXTRACT_REGION: process.env.TEXTRACT_REGION || process.env.S3_REGION || "us-east-1",
}
```

### 4.3 Update GitHub Actions Secrets

Add to repository secrets:

- `TEXTRACT_REGION` (optional, defaults to `S3_REGION`)

Update workflow files (`.github/workflows/staging.yml` and `main.yml`):

```yaml
env:
  TEXTRACT_REGION: ${{ secrets.TEXTRACT_REGION || secrets.S3_REGION }}
```

---

## Phase 5: Database Repository Updates

### 5.1 Update Receipt File Repository

**File:** `packages/db/src/repositories/receiptFiles.repo.ts`

Verify `updateReceiptFile` handles the new timestamp fields:

- `ocrStartedAt`
- `ocrCompletedAt`
- `extractionStartedAt`
- `extractionCompletedAt`

### 5.2 Add OCR Results Repository

**File:** `packages/db/src/repositories/ocrResults.repo.ts` (new)

```typescript
import { db } from "../client";
import { ocrResults } from "../schema";
import { SlimOcrResult } from "@repo/services";
import { eq } from "drizzle-orm";

export async function createOcrResult(data: {
  receiptId: string;
  extractedText: SlimOcrResult;
  confidence?: number;
}) {
  const [result] = await db
    .insert(ocrResults)
    .values({
      receiptId: data.receiptId,
      extractedText: data.extractedText,
      confidence: data.confidence?.toString(),
    })
    .returning();
  return result;
}

export async function getOcrResultByReceiptId(receiptId: string) {
  const [result] = await db
    .select()
    .from(ocrResults)
    .where(eq(ocrResults.receiptId, receiptId))
    .limit(1);
  return result ?? null;
}
```

### 5.3 Updated Schema

**File:** `packages/db/src/schema/app.schema.ts` — `ocrResults` table:

```typescript
export const ocrResults = pgTable("ocr_results_table", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  receiptId: uuid("receipt_id")
    .references(() => receiptFiles.id, { onDelete: "cascade" })
    .notNull(),
  // rawResponse intentionally omitted — ~350kb of geometry per receipt, no downstream value
  // rawText (completeness guarantee) is embedded inside extractedText.rawText
  extractedText: jsonb("extracted_text").$type<SlimOcrResult>().notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## Phase 6: Testing Strategy

### 6.1 Unit Tests

- `textract.service.test.ts` — Mock Textract client, verify geometry is stripped, verify `rawText` captures all LINE blocks
- `openai-extraction.service.test.ts` — Mock OpenAI client, verify prompt includes both structured fields and `rawText`
- `phase1-processor.test.ts` — Test idempotency, retry logic, slim shape written to DB
- `phase2-processor.test.ts` — Test extraction flow, duplicate handling

### 6.2 Integration Tests

- End-to-end flow with real Textract on a sample receipt
- Verify `rawText` is non-empty and captures unclassified content
- Verify OpenAI extraction accuracy using the slim prompt format

### 6.3 Load Tests

- Batch upload 50 receipts
- Monitor Textract throttling
- Verify SQS retry behaviour

---

## Phase 7: Deployment Steps

### Step 1: Pre-deployment

- [x] Create dev S3 bucket
- [x] Test local dev with real S3
- [x] Enable `textract:AnalyzeExpense` IAM policy manually (validated)
- [x] Validate database migrations

### Step 2: Database Migration

- [x] Run migration 001 (add timestamp columns to receipt_files_table)
- [x] Run migration 002 (create ocr_results_table — no rawResponse column)
- [x] Run migration 003 (backfill existing statuses)
- [x] Verify data integrity

### Step 3: Code Deployment

- [ ] Deploy to staging
- [ ] Verify Textract IAM permissions via CDK
- [ ] Test with sample receipts end-to-end
- [ ] Monitor error rates and OCR confidence scores

### Step 4: Production Deployment

- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Compare costs vs old approach

---

## Retry & Idempotency Matrix

| Scenario                   | Phase | Behavior                           | SQS Action                                        |
| -------------------------- | ----- | ---------------------------------- | ------------------------------------------------- |
| Textract throttling        | 1     | Mark failed, throw retryable error | Return batchItemFailure, SQS retries              |
| Textract invalid S3 object | 1     | Mark failed, no retry              | No failure reported (permanent)                   |
| No expense doc in response | 1     | Mark failed, no retry              | No failure reported (permanent)                   |
| OpenAI 429                 | 2     | Retry 3x with backoff              | Return batchItemFailure on final failure          |
| OpenAI schema error        | 2     | Mark failed, no retry              | No failure reported (permanent)                   |
| Lambda timeout in Phase 1  | 1     | SQS visibility timeout expires     | Message retried, Phase 1 re-runs (idempotent)     |
| Lambda timeout in Phase 2  | 2     | SQS visibility timeout expires     | Message retried, Phase 1 skipped, Phase 2 re-runs |
| DB connection error        | Both  | Throw error                        | SQS retries indefinitely                          |

---

## Cost Estimation

### Current (OpenAI Vision)

- 1,000 receipts/day
- ~500 tokens/receipt
- Cost: ~$5–10/day ($150–300/month)

### New (Textract AnalyzeExpense + OpenAI Text)

- Textract `AnalyzeExpense`: ~$1.50/day ($45/month)
- OpenAI text (slim prompt, fewer tokens): ~$0.50/day ($15/month)
- **Total: ~$2/day ($60/month)**

**Savings: ~70–80%**

---

## Monitoring & Alerting

### Metrics to Track

1. Phase 1 duration (Textract latency)
2. Phase 2 duration (OpenAI latency)
3. Phase 1 failure rate
4. Phase 2 failure rate
5. Average OCR confidence score
6. OpenAI token usage vs old approach

### Alerts

- Textract throttling > 5% of requests
- Phase 2 failure rate > 2%
- Average processing time > 30 seconds

---

## Rollback Plan

1. **Revert Lambda code** to pre-2-phase version
2. **Database remains compatible** — old code ignores new columns
3. **In-flight receipts** will complete with new flow or fail safely
4. **No data loss** — all states are recoverable

---

## Open Questions

1. **OCR Confidence Threshold** — Minimum confidence before failing Phase 1?
2. **Fallback Strategy** — If `AnalyzeExpense` returns no `SummaryFields`, proceed with `rawText` only or fail?

---

## Appendix: File Changes Summary

### New Files

- `packages/services/src/ocr/ocr.interface.ts`
- `packages/services/src/ocr/textract.service.ts`
- `packages/services/src/extraction/extraction.interface.ts`
- `packages/services/src/extraction/openai-extraction.service.ts`
- `packages/services/src/orchestration/phase1-processor.ts`
- `packages/services/src/orchestration/phase2-processor.ts`
- `packages/db/src/repositories/ocrResults.repo.ts`

### Modified Files

- `packages/services/src/storage.service.ts` — S3 endpoint config
- `packages/services/src/process.ts` — New 2-phase flow
- `packages/services/src/index.ts` — Export new modules
- `packages/services/package.json` — Add `@aws-sdk/client-textract`
- `apps/web/server/services/storage.service.ts` — S3 endpoint config
- `apps/worker/infra/lib/worker-stack.ts` — IAM permissions (`AnalyzeExpense` only)
- `packages/db/src/schema/app.schema.ts` — Updated `ocrResults` table (no `rawResponse`)
- `.github/workflows/staging.yml` — Add `TEXTRACT_REGION`
- `.github/workflows/main.yml` — Add `TEXTRACT_REGION`
- `docker-compose.yml` — Remove MinIO
- `README.md` — Update setup instructions

### Database Migrations

- `packages/db/drizzle/XXXX_add_ocr_timestamps.sql`
- `packages/db/drizzle/XXXX_create_ocr_results.sql`
- `packages/db/drizzle/XXXX_backfill_statuses.sql`
