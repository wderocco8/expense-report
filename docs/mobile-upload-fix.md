# Mobile Upload Fix

## Problem

Vercel enforces a **4.5MB request body limit**. iPhone photos are typically 8–12MB each, so even a single mobile upload hits this ceiling. The current flow sends all files in one POST request, making large mobile batches impossible.

Secondary concern: storing and running Textract on oversized images wastes S3 storage and increases OCR costs unnecessarily.

---

## Stage 1: Client Compression + Server Guardrails

Solves the immediate mobile upload failure. Keeps the existing single-request flow; just shrinks each file before sending.

### Constraints

- Target per-file size after compression: **~300KB**
- With `MAX_FILES_PER_UPLOAD = 10`: 10 × 300KB = 3MB — safely under Vercel's 4.5MB limit
- 300KB JPEG at ≤1600px is more than sufficient for Textract `AnalyzeExpense`

### Changes

**`packages/shared/src/domain/expense-reports/constants.ts`**
- Lower `MAX_FILES_PER_UPLOAD`: 40 → 10
- Add `MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024` (2MB server-side backstop)

**`apps/web/components/receipt-files/scan-upload-receipts.tsx`**
- Install `browser-image-compression`
- Add a `compressFile(file: File): Promise<File>` helper in `onSubmit` that runs before building `FormData`
- Compression params: `{ maxSizeMB: 0.3, maxWidthOrHeight: 1600, useWebWorker: true }`
- HEIC handling: attempt compression (works on iOS Safari, which can canvas-decode HEIC); on failure, pass the original file through — the server's existing `heic-convert` path handles it

**`apps/web/app/api/receipts/route.ts`**
- Add a per-file size check after MIME validation: if `file.size > MAX_FILE_SIZE_BYTES`, reject with a `400 receipt/file-too-large` problem

**`apps/web/server/services/receipts.service.ts`**
- Enable the commented-out `sharp` resize block inside `normalizeReceiptImage`, running it after HEIC→JPEG conversion
- This acts as a server-side backstop for HEIC files that bypass client compression (e.g. uploaded from desktop Chrome, which cannot canvas-decode HEIC)
- Params: `resize({ width: 1600, withoutEnlargement: true })` + `jpeg({ quality: 80 })`

### Notes

- `browser-image-compression` outputs JPEG regardless of input format (for compressible types), so files arriving at the server will always be JPEG/PNG/WebP/HEIC — no MIME type surprise
- The server's `VALID_FILE_TYPES` check remains unchanged; HEIC is still accepted for the passthrough path

---

## Stage 2: Batched Parallel Uploads

Removes the ceiling on batch size entirely. Users can select 40+ files; the client handles chunking transparently.

### Approach

Split files into chunks of `UPLOAD_BATCH_SIZE = 5`, then fire all chunks as parallel `fetch` calls. Each batch is a standard POST to `/api/receipts`. `Promise.all` waits for all batches before closing the sheet.

**Math:** 40 files → 8 batches × 5 files × 300KB = ~1.5MB per request. Scales to any batch size.

### Changes

**`packages/shared/src/domain/expense-reports/constants.ts`**
- Raise `MAX_FILES_PER_UPLOAD` back to 40 (or remove the cap)
- Add `UPLOAD_BATCH_SIZE = 5`

**`apps/web/components/receipt-files/scan-upload-receipts.tsx`**
- Add `uploadedCount: number` state (outside react-hook-form — this is display-only)
- In `onSubmit`:
  1. Compress all files
  2. Chunk into groups of `UPLOAD_BATCH_SIZE`
  3. `await Promise.all(chunks.map(chunk => uploadChunk(chunk)))`
  4. Increment `uploadedCount` as each chunk resolves (use `.then()` on individual chunk promises before passing to `Promise.all`)
- Show progress in the sheet: `"Uploading {uploadedCount} / {total}..."` while `isSubmitting`

**Error handling for partial failures**
- Collect results from all chunk fetches; don't short-circuit on one failure
- If all batches fail: keep the form open, show an inline error
- If some batches fail: close form, `router.refresh()`, show a toast: `"{n} uploaded, {m} failed — try re-uploading the failed files"`
- The `/api/receipts` route already returns `{ success: true }` on success; on failure it returns a Problem Details JSON — use this to distinguish

### react-hook-form compatibility

Both stages touch only `onSubmit`. react-hook-form owns validation and file state; compression and batching are plain async logic inside the submit handler. No restructuring needed.
