# Mobile Upload Fix

## Problem

Vercel enforces a **4.5MB request body limit**. iPhone photos (HEIC/HEIF) are typically 8–12MB each, so even a single mobile upload fails. HEIC is also unsupported by the Canvas API in non-WebKit browsers, ruling out purely client-side conversion. A correct cross-browser, cross-platform solution requires bypassing Vercel for the file transfer entirely.

---

## Solution: Presigned S3 PUT Uploads

The client uploads files directly to S3 using backend-generated presigned PUT URLs. Vercel never handles the file bytes. Conversion and compression move to the worker, where they run once before Textract.

---

## Upload Flow (replaces `POST /api/receipts`)

1. **`POST /api/receipts/presign`** — client sends `{ jobId, files: [{ name, type }] }`. Backend verifies auth and job ownership, creates N `receipt_files` DB records (status: `pending`) with pre-assigned S3 keys, returns `[{ receiptId, presignedUrl }]`.

2. **Client PUTs files directly to S3 in parallel** — one `fetch` PUT per file using the presigned URL. No Vercel involvement. Truly parallel — no batching needed.

3. **`POST /api/receipts/confirm`** — client sends `{ receiptIds: string[] }`. Backend enqueues SQS for each.

---

## Worker Changes (Phase 1 — before Textract)

Raw files land in S3 unprocessed. Phase 1 adds a normalization step before calling Textract:

1. Download raw file from S3
2. If HEIC/HEIF: convert to JPEG using `heic-convert`
3. Resize and compress with `sharp` for **all** file types: `resize({ width: 1600, withoutEnlargement: true })` + `jpeg({ quality: 0.8 })`
4. Re-upload processed JPEG to the **same S3 key** (atomic overwrite) with `ContentType: 'image/jpeg'`
5. Call Textract with the processed key

S3 keys have no extension (see key format above), so there is nothing misleading after the worker overwrites the raw upload with a processed JPEG.

---

## Web Layer Changes

**`apps/web/server/services/receipts.service.ts`**
- Delete `normalizeReceiptImage` and `buildReceiptUpload` — this logic moves to the worker
- Remove `heic-convert` dependency from the web app
- Add `generatePresignedPutUrl(key, contentType, expiresIn)` to `storage.service.ts` — uses the existing `@aws-sdk/s3-request-presigner` already in the project
- Add `presignReceiptUploads(jobId, files)` service function that generates keys, creates DB records, and returns presigned URLs

**New API routes**
- `POST /api/receipts/presign` — replaces the multipart-handling portion of the current `POST /api/receipts`
- `POST /api/receipts/confirm` — accepts `{ receiptIds }`, enqueues SQS

**S3 key format**

Keys use `receipts/{jobId}/{receiptFileId}` — no extension. The receipt DB record ID is generated first and reused as the S3 object name, so both the DB row and the S3 object share the same UUID. The `s3Key` column becomes fully derivable from the record (`receipts/${jobId}/${id}`); keep it explicit on the row for flexibility. Extensions are omitted entirely — S3 and the browser both use `ContentType` metadata, not the filename, so the extension was never meaningful and becomes actively misleading after the worker overwrites HEIC with JPEG.

**`apps/web/components/receipt-files/scan-upload-receipts.tsx`**

`onSubmit` changes:
1. Call `/api/receipts/presign` with file metadata
2. `await Promise.all(files.map((file, i) => fetch(presignedUrls[i], { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })))` — increment an `uploadedCount` state as each PUT resolves
3. Call `/api/receipts/confirm` with receiptIds
4. Close form, `router.refresh()`

**Progress indicator**: show a progress bar or subtle line (e.g. shadcn `Progress`) below the file list while submitting, tracking `uploadedCount / totalFiles`. Disappears once all uploads complete and `/confirm` is called.

**Navigation guard**: while `isSubmitting`, block two scenarios:
- Sheet close / cancel button: disable or intercept, same pattern as the unsaved-changes guard in `ExtractedExpenseSheet`
- Page refresh / tab close: add a `beforeunload` listener (like the one in `ExtractedExpenseSheet`) that fires while `isSubmitting` is true

No client-side compression or conversion — none needed.

---

## S3 CORS Configuration

Required for browser PUT requests to succeed. Add a CORS rule to the bucket:

```json
[{
  "AllowedHeaders": ["Content-Type"],
  "AllowedMethods": ["PUT"],
  "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
  "MaxAgeSeconds": 3600
}]
```

This applies to both the production bucket and the local dev bucket.

---

## Removed Complexity

- No client-side HEIC conversion library (`heic2any`, WASM)
- No client-side compression (`browser-image-compression`)
- No batching — all uploads truly parallel with no ceiling
- `MAX_FILES_PER_UPLOAD` can be raised or removed; the only remaining constraint is UX

---

## Edge Cases

- **Orphaned objects**: If the client uploads to S3 but crashes before calling `/confirm`, SQS is never enqueued and the receipt stays `pending` indefinitely. Acceptable at this scale; mitigatable later with an S3 lifecycle expiry rule on the `receipts/` prefix.
- **Failed worker normalization**: Corrupt or unsupported file causes `heic-convert`/`sharp` to throw → worker marks receipt `failed`. Raw file remains in S3 until a cleanup pass.
- **`/confirm` without verifying S3 existence**: Don't add a per-key existence check — just enqueue and let the worker report failure. The check adds latency on the happy path for no benefit.
