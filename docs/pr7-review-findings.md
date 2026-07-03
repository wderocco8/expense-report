# PR #7 Review Findings (Mobile Upload Resizing)

Findings from reviewing `fix/mobile-upload-resizing` → `dev/2.0`. Tackle one at a time; check off as fixed.

## 1. [x] ~~Confirm endpoint swallows per-item failures, always reports success~~ — DEFERRED

**File:** `apps/web/app/api/receipts/route.ts:27-49`

Every enqueue/mark-failed call inside the `POST` (confirm) handler is wrapped in `Promise.allSettled`. Rejections (receipt not found, ownership mismatch, `enqueueReceiptProcessing` throwing) are only `console.error`'d — the handler unconditionally returns `{ success: true }`. The client resets the form and shows no error while the receipt is stuck at `pending` forever with no retry path.

**Decision (2026-07-03):** Deferred. Likelihood of SQS/DB throwing here is low enough not to justify the added complexity pre-scale. Revisit once there are real users.

The sibling `DELETE` handler in the same file already does this correctly, returning `{ deleted, failed }` — reuse that pattern here.

## 2. [x] Missing `.rotate()` — mobile photos with EXIF orientation come out sideways — FIXED

**File:** `packages/services/src/orchestration/phase1-processor.ts:85-89`

Sharp does not auto-orient by default, and strips the EXIF orientation tag on output by default too. Phone photos are commonly stored as landscape pixels + an orientation tag — without an explicit `.rotate()` (no args) call before `.resize()`, the output JPEG had neither the correct pixel orientation nor the metadata to fix it, which also degraded Textract OCR accuracy on rotated receipts. User confirmed seeing this in testing.

**Decision (2026-07-03):** Fixed — added `.rotate()` before `.resize()` so sharp auto-orients using EXIF before compressing.

## 3. [x] ~~Non-atomic per-file DB inserts in presign can orphan `receipt_files` rows~~ — DEFERRED

**File:** `apps/web/server/services/receipts.service.ts:28-44` (`presignReceiptUploads`)

`Promise.all` runs one DB insert + presign per file. If any single insert throws, the whole request rejects and the client never receives any presigned URLs — including for files whose inserts already committed. Those rows are permanently stuck at `pending` with no recovery path (worse than the "orphaned S3 object" case already documented in `docs/mobile-upload-fix.md`).

**Decision (2026-07-03):** Deferred, same reasoning as #1 — DB insert failure mid-batch is low-probability; not worth the added complexity pre-scale. Revisit once there are real users. See `[[feedback_defer_low_probability_error_handling]]`.

## 4. [x] 60s presigned-URL expiry may be too short for large mobile batches — FIXED

**File:** `apps/web/server/services/storage.service.ts:95-99`

All presigned URLs for a batch (up to `MAX_FILES_PER_UPLOAD = 40`) are minted up front, but the client's `Promise.all` PUTs are throttled by the browser's per-host connection limit (~6 concurrent). On a slow mobile connection with many large (up to 15MB) files, later files in the queue may not start their PUT until after the 60s window (which starts at presign time, not PUT-start time) has elapsed, producing spurious `failedIds`.

**Decision (2026-07-03):** Fixed — bumped default `expiresInSeconds` from 60 to 900 (15 min) in `generatePresignedPutUrl`. Comfortably covers worst-case large-batch/slow-connection scenarios (7 waves of ~6 concurrent uploads × up to ~2 min/file on a poor connection) while remaining short-lived and scoped to a single PUT on a single key.

## 5. [x] ~~`failedReceiptIds` branch has no guard against overwriting a receipt past `pending`~~ — SKIPPED

**File:** `apps/web/app/api/receipts/route.ts:33-39`

Only an ownership check runs before unconditionally setting `status: "failed"`. A stale or replayed `failedReceiptIds` entry referencing an already-`complete` receipt would silently overwrite it to `failed`, hiding a fully-extracted expense even though the extraction data is still intact in the DB.

**Decision (2026-07-03):** Skipped. Requires a stale/replayed client request to trigger; not worth guarding against pre-scale.

## 6. [ ] Duplicate S3 client + duplicate key-building convention

**Files:** `packages/services/src/storage/s3.service.ts`, `apps/web/server/services/storage.service.ts`, `apps/web/server/services/receipts.service.ts`

- `s3.service.ts` and `storage.service.ts` each instantiate an independent `S3Client` with near-identical bucket/region/credentials/endpoint config (and an identical `streamToBuffer` helper), with no shared module.
- `presignReceiptUploads` builds keys as `receipts/{jobId}/{id}` (no extension) while `buildReceiptUpload` in the same file builds `receipts/{jobId}/{uuid}.{ext}` (with extension) — two independently-hardcoded conventions for the same prefix.

## 7. [ ] `sharp@0.34.5` hardcoded identically in 3 separate files

**Files:** `.github/workflows/main.yml`, `.github/workflows/staging.yml`, `apps/worker/scripts/deploy-local.sh`

Each hardcodes the same install command and version, requiring manual synchronization with no CI check enforcing it (`docs/mobile-upload-fix.md` already admits this). A missed update silently ships a version-mismatched sharp binary to one environment. Consider a single shared script or reading the version from `packages/services/package.json`.

## 8. [ ] `normalizeImage` unconditionally re-runs on every Phase 1 attempt, including retries

**File:** `packages/services/src/orchestration/phase1-processor.ts` (`normalizeImage`)

No check for "already normalized" before the S3 GET → sharp transform → S3 PUT round trip. Every receipt pays this cost even if already a small compressed JPEG, and any retry (SQS redelivery, transient Textract failure) re-runs a lossy JPEG re-encode on an already-processed image, adding progressive quality loss and wasted Lambda time.

---

**Priority:** #1–3 are correctness blockers worth fixing before merge. #4–5 need a decision (accept the risk or add a guard). #6–8 are cleanup/maintenance, not correctness blockers.
