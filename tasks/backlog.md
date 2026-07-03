# Backlog

Prioritized list of upcoming work. Move items to `active.md` when starting, `archive.md` when done.

---

## Critical Bug Fixes

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

---

## High Priority

- [ ] Auth Email Verification — BACKLOGGED
  - Add email verification flow to authentication
  - Requires: email service integration (Resend, SendGrid, etc.)
  - **Blocking For**: Organization invitations (need to send invite emails)
  - **NOTE**: Requires purchasing a domain, so postponed for now.

- [ ] Per-User Receipt Queue Limits (Anti-Abuse / Fairness)
  - **Problem**: Single user can monopolize the queue by uploading 100+ receipts at once, starving other users
  - **Current Behavior**: FIFO queue means large batches block all subsequent users
  - **Impact**: Poor user experience — users with small batches wait behind large batches
  - **Solution (Phase 1 — Postgres-based)**:
    - Check `COUNT(*) FROM receipt_files WHERE userId = ? AND status IN ('pending', 'processing')` before allowing new uploads
    - Limit: Max 50 pending/processing receipts per user
    - If limit exceeded, reject upload with clear error message: "You have X receipts processing. Please wait for them to complete."
    - **Why Postgres**: Already using it, fast enough for this check, no additional infrastructure needed
  - **Alternatives Considered**:
    - Redis: Faster but adds infrastructure complexity
    - Per-user SQS queues: True fairness but complex CDK setup, Lambda event source limits
  - **Future Phases** (backlogged):
    - Phase 2: API rate limiting (uploads per minute per user)
    - Phase 3: Priority queue or per-user queues with Two-Phase Processing

- [ ] Rate Limiting (General API) — BACKLOGGED
  - Implement API rate limiting to prevent abuse
  - Consider: Redis, Upstash, or Next.js middleware approach
  - **Note**: De-prioritized in favor of Per-User Receipt Limits (simpler, addresses immediate need)

- [ ] Database Sorting + Filtering
  - Add sorting and filtering capabilities to database queries
  - Likely involves query builder updates and UI controls

- [ ] Receipt Retry Mechanism
  - Ability to retry failed receipts from the UI
  - Option to retry successful receipts (if extraction was incorrect)
  - Add retry button with confirmation dialog
  - Track retry attempts and limit to prevent abuse

---

## Medium Priority

- [ ] Consolidate Duplicate S3 Client + Unify Receipt S3 Key Convention
  - **Problem**: `packages/services/src/storage/s3.service.ts` (worker) and `apps/web/server/services/storage.service.ts` (web) each instantiate an independent `S3Client` with near-identical bucket/region/credentials/endpoint config, plus a duplicated `streamToBuffer` helper — no shared module, so the two can drift silently (e.g. a retry/timeout/endpoint fix applied to one but not the other)
  - **Also**: Receipt S3 keys are built two different ways — `presignReceiptUploads` (scan-upload path) uses `receipts/{jobId}/{id}` with no extension, matching the convention documented in `docs/mobile-upload-fix.md`, while `buildReceiptUpload` (manual-upload path) still appends a file extension (`receipts/{jobId}/{uuid}.{ext}`) — out of sync with that doc, which explicitly calls extensions misleading once the worker overwrites HEIC uploads with JPEG in place
  - **Proposed Solution**:
    - Move presigned-URL generation (`generatePresignedPutUrl`, `getSignedReceiptUrl`) into `packages/services/src/storage/s3.service.ts` and export it from the package's `index.ts`
    - Add `@repo/services` as a dependency of `apps/web`, point existing callers at it, and delete `apps/web/server/services/storage.service.ts`'s duplicate `S3Client`
    - Add one shared `buildReceiptS3Key(jobId, id)` helper (no extension) used by both the manual and presigned upload paths
  - **Origin**: Flagged in code review of PR #7 (`fix/mobile-upload-resizing`), see `docs/pr7-review-findings.md` #6. Deferred as out of scope for that PR.

- [ ] Export Settings Enhancement
  - [ ] Option to export only completed expenses (exclude failed/pending)
  - [ ] Option to export with/without images attached
  - [ ] Ability to export all receipt images into a zip file
  - Consider UI for export configuration before download

- [ ] Image Compression (Browser)
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

---

## Lower Priority

- [ ] Currency Conversions
  - Add support for multi-currency expenses
  - Auto-detect currency from receipt
  - Convert to base currency for reporting
  - Store exchange rates at time of extraction

---

## Feature Enhancements

- [ ] Hotel Nights Field
  - Add field for number of nights stayed in hotel (similar to transit-mode)
  - Ability to add/remove transit-mode fields dynamically
  - Ability to add/remove hotel nights fields dynamically
  - UI: + button to add fields, X button to remove
  - Update data model to support variable fields per expense type

---

## Complex / Long-term

- [ ] Organizations & Team Support (B2B Feature)
  - **Goal**: Enable organizations/teams to use the app with shared expense reports and per-seat billing
  - **Business Model**: Organizations pay for seats or usage-based plans (exact pricing TBD)
  - **Why Before Flexible Schema**: Custom schemas should be org-level configurations (admins define schemas for their org)
  - **Better Auth Integration**: Use `better-auth/plugins/organization` plugin (not currently enabled)
    - Handles orgs, members, invitations, roles out of the box
    - See: https://www.better-auth.com/docs/plugins/organization
  - **Schema Changes Required**:
    - Add `organization_id` to `expense_report_jobs_table` (nullable for personal accounts)
    - Add `organization_id` to `receipt_files_table` (for queries)
    - Update all queries to filter by `organization_id` when in org context
    - Consider: separate tables for org-level settings vs user-level
  - **Features**:
    - [ ] Organization creation and management UI
    - [ ] Member invitations (email-based)
    - [ ] Role-based access (owner, admin, member)
    - [ ] Organization switcher in UI (like Vercel/Linear)
    - [ ] Shared expense reports within org
    - [ ] Usage tracking per org (for billing)
    - [ ] Org-level settings (default categories, custom fields prep)
  - **Data Isolation Strategy**:
    - Option A: Add org_id to all tables, filter queries
    - Option B: Postgres row-level security (RLS) policies
    - Option C: Schema-per-tenant (overkill for now)
  - **Blocking/Related Tasks**:
    - Flexible Schema (should be org-level feature)
    - Billing integration (Stripe for per-seat billing)
    - Per-User Receipt Queue Limits (needs org-level limits too)
  - **Migration Path**:
    - Personal accounts remain as-is (org_id = null)
    - Users can create orgs and invite members
    - Existing jobs can optionally be moved to org (or stay personal)

- [ ] Flexible Schema (high level, very complex initiative)
  - Allow users to define custom fields/structures
  - Requires significant architecture changes
  - Research: dynamic schemas, metadata storage approaches
  - **Note**: Should be implemented AFTER Organizations (org admins define schemas for their org)
