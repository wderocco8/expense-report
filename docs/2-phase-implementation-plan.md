# 2-Phase Receipt Processing Implementation Plan

## Overview

Implement a two-phase receipt processing pipeline using **AWS Textract** for OCR (Phase 1) and **OpenAI** for structured extraction (Phase 2).

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
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
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

### Migration 001: Add Phase Tracking to Receipts

```sql
-- Add phase tracking columns
ALTER TABLE receipt_files_table 
ADD COLUMN phase VARCHAR(20) NOT NULL DEFAULT 'pending' 
CHECK (phase IN ('pending', 'ocr_processing', 'ocr_complete', 'extracting', 'complete', 'failed'));

ALTER TABLE receipt_files_table 
ADD COLUMN ocr_text TEXT;

ALTER TABLE receipt_files_table 
ADD COLUMN ocr_provider VARCHAR(20) DEFAULT 'textract';

ALTER TABLE receipt_files_table 
ADD COLUMN ocr_started_at TIMESTAMP;

ALTER TABLE receipt_files_table 
ADD COLUMN ocr_completed_at TIMESTAMP;

ALTER TABLE receipt_files_table 
ADD COLUMN extraction_started_at TIMESTAMP;

-- Index for efficient phase queries
CREATE INDEX idx_receipt_files_phase ON receipt_files_table(phase);
```

### Migration 002: Create OCR Results Table

```sql
CREATE TABLE ocr_results_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipt_files_table(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL DEFAULT 'textract',
    raw_response JSONB NOT NULL,        -- Full Textract API response
    extracted_text TEXT NOT NULL,       -- Text sent to OpenAI
    confidence DECIMAL(5,2),            -- Average confidence score
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ocr_results_receipt_id ON ocr_results_table(receipt_id);
```

### Migration 003: Backfill Existing Data

```sql
-- Mark all existing completed receipts
UPDATE receipt_files_table 
SET phase = 'complete' 
WHERE status = 'complete';

-- Mark failed receipts
UPDATE receipt_files_table 
SET phase = 'failed' 
WHERE status = 'failed';
```

### Migration 004: Deprecate Old Status Column (Optional - Future)

```sql
-- After confirming 2-phase works, we can remove the old status column
-- ALTER TABLE receipt_files_table DROP COLUMN status;
```

---

## Phase 2: Package Structure Updates

### New Directory Structure

```
packages/
  services/
    src/
      ocr/
        textract.service.ts          # NEW: Textract integration
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
export interface OcrResult {
  text: string;
  confidence: number;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface OcrService {
  extractText(s3Bucket: string, s3Key: string): Promise<OcrResult>;
}
```

### 3.2 Textract Service

**File:** `packages/services/src/ocr/textract.service.ts`

```typescript
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { OcrResult, OcrService } from "./ocr.interface";

const textract = new TextractClient({ 
  region: process.env.TEXTRACT_REGION || process.env.S3_REGION || "us-east-1" 
});

export class TextractService implements OcrService {
  async extractText(s3Bucket: string, s3Key: string): Promise<OcrResult> {
    try {
      const command = new DetectDocumentTextCommand({
        Document: {
          S3Object: {
            Bucket: s3Bucket,
            Name: s3Key,
          },
        },
      });

      const response = await textract.send(command);
      
      // Extract text from LINE blocks
      const textBlocks = response.Blocks?.filter(b => b.BlockType === "LINE") || [];
      const extractedText = textBlocks.map(b => b.Text).join("\n");
      const avgConfidence = textBlocks.length > 0
        ? textBlocks.reduce((sum, b) => sum + (b.Confidence || 0), 0) / textBlocks.length
        : 0;

      return {
        text: extractedText,
        confidence: avgConfidence,
        success: true,
        shouldRetry: false,
      };
    } catch (error) {
      const shouldRetry = this.isRetryableError(error);
      return {
        text: "",
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown Textract error",
        shouldRetry,
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

export interface ExtractionResult {
  data: ReceiptDTO | null;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface ExtractionService {
  extractFromText(ocrText: string): Promise<ExtractionResult>;
}
```

### 3.4 OpenAI Extraction Service

**File:** `packages/services/src/extraction/openai-extraction.service.ts`

```typescript
import OpenAI from "openai";
import { ExtractionResult, ExtractionService } from "./extraction.interface";
import { ReceiptDTO, ReceiptSchema } from "@repo/shared";
import { ResponseTextConfig } from "openai/resources/responses/responses.mjs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Same schema as before
const ReceiptFormat: ResponseTextConfig = {
  format: {
    type: "json_schema",
    name: "receipt",
    strict: true,
    schema: { /* ... same schema ... */ },
  },
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

export class OpenAIExtractionService implements ExtractionService {
  async extractFromText(ocrText: string): Promise<ExtractionResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.callOpenAI(ocrText);
        return result;
      } catch (error) {
        lastError = error;
        
        if (this.isRateLimitError(error) && attempt < MAX_RETRIES) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }
        
        // Non-retryable error
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

  private async callOpenAI(ocrText: string): Promise<ExtractionResult> {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `Extract structured receipt data from this OCR text:\n\n${ocrText}`,
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

    return {
      data: parsed.data,
      success: true,
      shouldRetry: false,
    };
  }

  private isRateLimitError(error: unknown): boolean {
    return error instanceof OpenAI.APIError && 
           (error.status === 429 || error.code === "rate_limit_exceeded");
  }

  private getRetryDelay(attempt: number): number {
    return BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
  // Idempotency check
  const receipt = await getReceiptFile(receiptId);
  
  if (["ocr_complete", "complete", "extracting"].includes(receipt.phase)) {
    console.log(`[Phase 1] Receipt ${receiptId} already OCR'd, skipping`);
    return;
  }

  if (receipt.phase === "failed") {
    console.log(`[Phase 1] Receipt ${receiptId} previously failed, retrying OCR`);
  }

  // Mark as processing
  await updateReceiptFile(receiptId, { 
    phase: "ocr_processing",
    ocr_started_at: new Date(),
  });

  // Run Textract
  const result = await textractService.extractText(
    process.env.S3_BUCKET!,
    receipt.s3Key
  );

  if (!result.success) {
    await updateReceiptFile(receiptId, {
      phase: "failed",
      errorMessage: `OCR failed: ${result.error}`,
    });
    
    if (result.shouldRetry) {
      throw new Error(`Textract retryable error: ${result.error}`);
    }
    return;
  }

  // Store results
  await updateReceiptFile(receiptId, {
    phase: "ocr_complete",
    ocr_text: result.text,
    ocr_completed_at: new Date(),
  });

  // Store in audit table
  await createOcrResult({
    receiptId,
    provider: "textract",
    extracted_text: result.text,
    confidence: result.confidence,
    // raw_response: stored via separate call if needed
  });

  console.log(`[Phase 1] OCR complete for ${receiptId}`);
}
```

### 3.6 Phase 2 Processor

**File:** `packages/services/src/orchestration/phase2-processor.ts`

```typescript
import { getReceiptFile, updateReceiptFile, createExtractedExpense } from "@repo/db";
import { openaiExtractionService } from "../extraction/openai-extraction.service";
import { mapReceiptToDb } from "@repo/shared";

export async function processPhase2Extraction(receiptId: string): Promise<void> {
  // Idempotency check
  const receipt = await getReceiptFile(receiptId);
  
  if (receipt.phase === "complete") {
    console.log(`[Phase 2] Receipt ${receiptId} already complete, skipping`);
    return;
  }

  if (receipt.phase !== "ocr_complete") {
    throw new Error(
      `[Phase 2] Receipt ${receiptId} not ready (phase: ${receipt.phase})`
    );
  }

  if (!receipt.ocr_text) {
    throw new Error(`[Phase 2] Receipt ${receiptId} missing OCR text`);
  }

  // Mark as extracting
  await updateReceiptFile(receiptId, { 
    phase: "extracting",
    extraction_started_at: new Date(),
  });

  // Run extraction
  const result = await openaiExtractionService.extractFromText(receipt.ocr_text);

  if (!result.success) {
    await updateReceiptFile(receiptId, {
      phase: "failed",
      errorMessage: `Extraction failed: ${result.error}`,
    });
    
    if (result.shouldRetry) {
      throw new Error(`Extraction retryable error: ${result.error}`);
    }
    return;
  }

  // Save to database
  const dbRecord = mapReceiptToDb(result.data!, receiptId);
  
  try {
    await createExtractedExpense(dbRecord);
  } catch (error) {
    // Handle duplicate (idempotent)
    if (isDuplicateError(error)) {
      console.log(`[Phase 2] Duplicate extraction for ${receiptId}`);
    } else {
      throw error;
    }
  }

  // Mark complete
  await updateReceiptFile(receiptId, { phase: "complete" });
  console.log(`[Phase 2] Extraction complete for ${receiptId}`);
}

function isDuplicateError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes("unique constraint") ||
    error.message.includes("uniq_active_receipt")
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

  // Skip if already complete
  if (receipt.phase === "complete") {
    console.log(`[Process] Receipt ${receiptId} already complete`);
    return;
  }

  // Phase 1: OCR (if not done)
  if (["pending", "failed"].includes(receipt.phase)) {
    await processPhase1Ocr(receiptId);
    
    // Re-fetch to check state
    const updated = await getReceiptFile(receiptId);
    if (updated.phase !== "ocr_complete") {
      return; // Phase 1 failed
    }
  }

  // Phase 2: Extraction
  if (receipt.phase === "ocr_complete" || receipt.phase === "extracting") {
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

// In constructor, after Lambda creation:

// Add Textract permissions
receiptProcessor.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "textract:DetectDocumentText",
      "textract:AnalyzeDocument",
    ],
    resources: ["*"], // Textract doesn't support resource-level permissions
  })
);

// Add S3 read permissions for Textract
receiptProcessor.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ["s3:GetObject"],
    resources: [`arn:aws:s3:::${process.env.S3_BUCKET}/*`],
  })
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
- `TEXTRACT_REGION` (optional, defaults to S3_REGION)

Update workflow files:
- `.github/workflows/staging.yml`
- `.github/workflows/main.yml`

```yaml
env:
  # ... existing env vars
  TEXTRACT_REGION: ${{ secrets.TEXTRACT_REGION || secrets.S3_REGION }}
```

---

## Phase 5: Database Repository Updates

### 5.1 Update Receipt File Repository

**File:** `packages/db/src/repositories/receiptFiles.repo.ts`

Add functions:
- `getReceiptFile(id)` - already exists, verify it selects new columns
- `updateReceiptFile(id, data)` - update to handle phase fields
- `createOcrResult(data)` - new function

### 5.2 Add OCR Results Repository

**File:** `packages/db/src/repositories/ocrResults.repo.ts` (new)

```typescript
import { db } from "../client";
import { ocrResults } from "../schema";

export async function createOcrResult(data: {
  receiptId: string;
  provider: string;
  extracted_text: string;
  confidence?: number;
  raw_response?: unknown;
}) {
  return db.insert(ocrResults).values({
    receiptId: data.receiptId,
    provider: data.provider,
    extractedText: data.extracted_text,
    confidence: data.confidence?.toString(),
    rawResponse: data.raw_response,
  });
}
```

---

## Phase 6: Testing Strategy

### 6.1 Unit Tests

- `textract.service.test.ts` - Mock Textract client
- `openai-extraction.service.test.ts` - Mock OpenAI client
- `phase1-processor.test.ts` - Test idempotency, retry logic
- `phase2-processor.test.ts` - Test extraction flow

### 6.2 Integration Tests

- End-to-end flow with real Textract (use sample receipt)
- Verify OCR text quality
- Verify OpenAI extraction accuracy

### 6.3 Load Tests

- Batch upload 50 receipts
- Monitor Textract throttling
- Verify SQS retry behavior

---

## Phase 7: Deployment Steps

### Step 1: Pre-deployment
- [ ] Create dev S3 bucket
- [ ] Update local `.env.local`
- [ ] Test local dev with real S3
- [ ] Validate database migrations

### Step 2: Database Migration
- [ ] Run migration 001 (add phase columns)
- [ ] Run migration 002 (create ocr_results table)
- [ ] Run migration 003 (backfill existing data)
- [ ] Verify data integrity

### Step 3: Code Deployment
- [ ] Deploy to staging
- [ ] Verify Textract IAM permissions
- [ ] Test with sample receipts
- [ ] Monitor error rates

### Step 4: Production Deployment
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Compare costs vs old approach

---

## Retry & Idempotency Matrix

| Scenario | Phase | Behavior | SQS Action |
|----------|-------|----------|------------|
| Textract throttling | 1 | Retry with exponential backoff | Return batchItemFailure, SQS retries |
| Textract invalid S3 object | 1 | Mark failed, no retry | No failure reported (permanent) |
| OpenAI 429 | 2 | Retry 3x with backoff | Return batchItemFailure on final failure |
| OpenAI schema error | 2 | Mark failed, no retry | No failure reported (permanent) |
| Lambda timeout in Phase 1 | 1 | SQS visibility timeout expires | Message retried, Phase 1 re-runs (idempotent) |
| Lambda timeout in Phase 2 | 2 | SQS visibility timeout expires | Message retried, Phase 1 skipped, Phase 2 re-runs |
| DB connection error | Both | Throw error | SQS retries indefinitely |

---

## Cost Estimation

### Current (OpenAI Vision)
- 1000 receipts/day
- ~500 tokens/receipt
- Cost: ~$5-10/day ($150-300/month)

### New (Textract + OpenAI Text)
- 1000 receipts/day
- Textract: ~$1.50/day ($45/month)
- OpenAI: ~$0.50/day ($15/month)
- **Total: ~$2/day ($60/month)**

**Savings: ~70-80%**

---

## Monitoring & Alerting

### Metrics to Track
1. Phase 1 duration (Textract latency)
2. Phase 2 duration (OpenAI latency)
3. Phase 1 failure rate
4. Phase 2 failure rate
5. OCR confidence scores
6. OpenAI token usage (vs old approach)

### Alerts
- Textract throttling > 5% of requests
- Phase 2 failure rate > 2%
- Average processing time > 30 seconds

---

## Rollback Plan

If issues arise:

1. **Revert Lambda code** to pre-2-phase version
2. **Database remains compatible** (old code ignores new columns)
3. **In-flight receipts** will complete with new flow or fail safely
4. **No data loss** - all states are recoverable

---

## Open Questions

1. **Raw Textract Response Storage**: Store full JSON or just key fields?
2. **OCR Confidence Threshold**: Minimum confidence before failing?
3. **Fallback Strategy**: If Textract fails, retry or skip?

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
- `packages/services/src/storage.service.ts` - S3 endpoint config
- `packages/services/src/process.ts` - New 2-phase flow
- `packages/services/src/index.ts` - Export new modules
- `packages/services/package.json` - Add @aws-sdk/client-textract
- `apps/web/server/services/storage.service.ts` - S3 endpoint config
- `apps/worker/infra/lib/worker-stack.ts` - IAM permissions
- `apps/worker/index.ts` - Remove inter-receipt delay (optional)
- `packages/db/src/schema/app.schema.ts` - Add ocr_results table
- `.github/workflows/staging.yml` - Add TEXTRACT_REGION
- `.github/workflows/main.yml` - Add TEXTRACT_REGION
- `docker-compose.yml` - Remove MinIO
- `README.md` - Update setup instructions

### Database Migrations
- `packages/db/drizzle/XXXX_add_phase_tracking.sql`
- `packages/db/drizzle/XXXX_create_ocr_results.sql`
- `packages/db/drizzle/XXXX_backfill_phases.sql`
