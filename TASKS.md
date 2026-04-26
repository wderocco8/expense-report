# Tasks

## In Progress

- [ ] Hydration Error - React hydration mismatch in sidebar components
  - Server/client ID mismatch in Radix UI components
  - Affects: `TeamSwitcher`, `SidebarMenuButton`, `AppSidebar`
  - Location: `components/ui/sidebar.tsx:515`

## Backlog

### Critical Bug Fixes (High Priority)

- [x] OpenAI 429 Error Handling & Rate Limiting (COMPLETED - 2024-04-26)
  - **Problem**: OpenAI returns 429 errors when processing many files consecutively
  - **Issue**: `@packages/services/src/process.ts` swallows these errors
  - **Impact**: Receipts get stuck in "processing" phase indefinitely
  - **Solution Implemented**:
    - Infrastructure (`worker-stack.ts`): 
      - `batchSize: 2` (each Lambda processes max 2 receipts)
      - `maxConcurrency: 4` (max 4 concurrent Lambda invocations)
      - `visibilityTimeout: 150s` (slightly > Lambda timeout of 120s)
      - Max 8 concurrent OpenAI calls = ~192k TPM (within 200k limit)
    - OCR Service (`ocr.service.ts`): Added exponential backoff with jitter for 429 errors
      - Max 3 retries with delays: 200ms, 400ms, 800ms + random jitter
      - Non-429 errors bubble up immediately (not retried)
      - JSON parse errors and schema validation failures return as non-retryable failures
    - Worker Handler (`index.ts`): Added 100ms delay between receipt processing
      - Smooths out burst traffic when Lambda starts processing batch
    - Process Service (`process.ts`): Removed "processing" idempotency check
      - Allows retries of timed-out receipts to prevent stuck receipts
      - Added graceful handling of duplicate DB inserts
  - **Performance Results** (Stress Test: 80 receipts at once):
    - ~96.25% success rate (77/80 succeeded on first attempt)
    - ~3.75% failure rate due to 429s exhausting all retries
    - 0% stuck receipts (all eventually complete or fail properly)
    - Acceptable for current scale until Two-Phase Processing is implemented
  - **Known Issue**: Failed receipts NOT being sent to DLQ (see task below)

- [ ] DLQ (Dead Letter Queue) Not Receiving Failed Receipts
  - **Problem**: Receipts that fail processing are marked as "failed" in DB but SQS messages are not moved to DLQ
  - **Expected Behavior**: After `maxReceiveCount: 3` failures, message should go to DLQ
  - **Current Behavior**: Message is marked as failed but stays in main queue (invisible until visibility timeout expires)
  - **Impact**: Failed messages will be retried 3 times, then disappear (not in DLQ for inspection)
  - **Potential Causes**:
    - Lambda returns success even when receipt processing fails (batch item failures not properly reported)
    - `reportBatchItemFailures: true` may require specific response format
    - SQS redrive policy not working as expected
  - **Investigation Needed**: Check if `batchItemFailures` array is properly populated in Lambda response

- [ ] Error Transparency in Receipt Processing
  - **Problem**: Processing errors are swallowed silently
  - **Solution**:
    - Ensure all errors bubble up to UI with meaningful messages
    - Add error logging/monitoring (consider Sentry or similar)
    - Show failure reason in the UI for failed receipts

### High Priority

- [ ] Upgrade Node.js in GitHub Actions
  - Node.js 20 actions are deprecated. The following actions are running on Node.js 20 and may not work as expected: actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4. Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026. Node.js 20 will be removed from the runner on September 16th, 2026. Please check if updated versions of these actions are available that support Node.js 24. To opt into Node.js 24 now, set the FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true environment variable on the runner or in your workflow file. Once Node.js 24 becomes the default, you can temporarily opt out by setting ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

- [ ] Two-Phase Receipt Processing (Scalability Solution)
  - **Problem**: OpenAI vision API (gpt-4o-mini) has 200K TPM limit, limiting concurrency to ~8 receipts
  - **Impact**: Cannot scale beyond single user; high per-receipt costs (~$0.01/receipt)
  - **Solution** (Option 1 - Two-Phase Processing):
    - **Phase 1**: OCR text extraction using cheap/fast model (Tesseract, AWS Textract, or Gemini Flash)
      - Extract raw text from receipt images
      - Cost: ~80% reduction vs vision model
    - **Phase 2**: Structured data extraction using gpt-4o-mini on TEXT only
      - Parse OCR output into structured fields (merchant, amount, date, category)
      - Much faster (no image tokens)
      - Better rate limits for text-only models
  - **Expected Benefits**:
    - 2-5x faster processing
    - ~80% cost reduction
    - Ability to handle 10x+ more concurrent receipts
  - **Considerations**:
    - Phase 1 model selection (accuracy vs speed vs cost)
    - Orchestration complexity (queue between phases)
    - Error handling for OCR failures
    - Option 4 (hybrid strategy) for future: auto-select based on file type/size

- [ ] Rate Limiting (General API)
  - Implement API rate limiting to prevent abuse
  - Consider: Redis, Upstash, or Next.js middleware approach

- [ ] Database sorting + filtering
  - Add sorting and filtering capabilities to database queries
  - Likely involves query builder updates and UI controls

- [ ] Receipt Retry Mechanism
  - Ability to retry failed receipts from the UI
  - Option to retry successful receipts (if extraction was incorrect)
  - Add retry button with confirmation dialog
  - Track retry attempts and limit to prevent abuse

### Medium Priority

- [ ] Export Settings Enhancement
  - [ ] Option to export only completed expenses (exclude failed/pending)
  - [ ] Option to export with/without images attached
  - [ ] Ability to export all receipt images into a zip file
  - Consider UI for export configuration before download

- [ ] Image compression (browser)
  - Enable image uploads from mobile photos app
  - Compress images client-side before upload (critical for Vercel limits)
  - Consider libraries: `browser-image-compression`, `sharp` (server-side)
  - Add compression progress indicator for large files

- [ ] Duplicate Receipt Detection
  - Prevent or add warning when uploading existing receipt
  - Options:
    - File hash comparison (SHA256)
    - Image similarity detection (perceptual hash)
    - Warning dialog with option to proceed anyway
  - Show "already exists" indicator in upload UI

### Lower Priority

- [ ] Currency Conversions
  - Add support for multi-currency expenses
  - Auto-detect currency from receipt
  - Convert to base currency for reporting
  - Store exchange rates at time of extraction

- [ ] Auth email verification
  - Add email verification flow to authentication
  - Requires: email service integration (Resend, SendGrid, etc.)

### Feature Enhancements

- [ ] Hotel Nights Field
  - Add field for number of nights stayed in hotel (similar to transit-mode)
  - Ability to add/remove transit-mode fields dynamically
  - Ability to add/remove hotel nights fields dynamically
  - UI: + button to add fields, X button to remove
  - Update data model to support variable fields per expense type

### Complex / Long-term

- [ ] Flexible schema (high level, very complex initiative)
  - Allow users to define custom fields/structures
  - Requires significant architecture changes
  - Research: dynamic schemas, metadata storage approaches

## Completed

- [x] OpenAI 429 Error Handling & Rate Limiting (2024-04-24)
  - Files modified:
    - `apps/worker/infra/lib/worker-stack.ts` - Reduced batchSize from 5 to 2
    - `apps/worker/index.ts` - Added 100ms delay between receipt processing
    - `packages/services/src/ocr.service.ts` - Added exponential backoff retry logic

---

## Notes

- Using this file for AI-managed task tracking instead of Notion
- Tasks are organized by priority and complexity
- Check off items as they are completed
- Add new tasks to appropriate section
- Critical bugs should be prioritized over new features
