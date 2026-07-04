# Archive

Completed tasks, most recent first.

---

## 2026-05-24

- [x] Upgrade Node.js in GitHub Actions
  - Upgraded all actions from v4 to v6 across `staging.yml` and `main.yml`:
    - `actions/checkout@v4` → `@v6`
    - `actions/setup-node@v4` → `@v6`
    - `pnpm/action-setup@v4` → `@v6`
    - `aws-actions/configure-aws-credentials@v4` → `@v6`
  - v6 of all these actions runs on Node.js 24, resolving the deprecation warnings

---

## 2024-04-26

- [x] Two-Phase Receipt Processing (Scalability Solution)
  - **Problem**: OpenAI vision API (gpt-4o-mini) has 200K TPM limit, limiting concurrency to ~8 receipts
  - **Impact**: Cannot scale beyond single user; high per-receipt costs (~$0.01/receipt)
  - **Solution**:
    - **Phase 1**: OCR text extraction via AWS Textract `AnalyzeExpense`
      - Stores `SlimOcrResult` (summaryFields + lineItems + rawText, ~1–3 KB) in `ocr_results_table`
      - Status: `pending → ocr_processing → ocr_complete`
    - **Phase 2**: Structured extraction via `gpt-4o-mini` on OCR text only
      - Saves structured data to `extracted_expenses_table`
      - Status: `ocr_complete → extracting → complete`
  - **Results**: 2-5x faster, ~80% cost reduction, supports 10x+ concurrent receipts

- [x] OpenAI 429 Error Handling & Rate Limiting
  - **Problem**: OpenAI returns 429 errors when processing many files consecutively
  - **Issue**: `@packages/services/src/process.ts` swallowed these errors, leaving receipts stuck in "processing"
  - **Solution**:
    - Infrastructure (`worker-stack.ts`): `batchSize: 2`, `maxConcurrency: 4`, `visibilityTimeout: 150s`
    - OCR Service (`ocr.service.ts`): Exponential backoff with jitter for 429s (max 3 retries: 200ms, 400ms, 800ms)
    - Worker Handler (`index.ts`): 100ms delay between receipts to smooth burst traffic
    - Process Service (`process.ts`): Removed "processing" idempotency check; added graceful duplicate DB insert handling
  - **Stress Test Results** (80 receipts at once): ~96.25% success rate, 0% stuck receipts
  - Files modified:
    - `apps/worker/infra/lib/worker-stack.ts`
    - `apps/worker/index.ts`
    - `packages/services/src/ocr.service.ts`
