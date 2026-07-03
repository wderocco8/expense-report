# Mobile Upload Fix

## Problem

Vercel enforces a **4.5MB request body limit**. iPhone photos (HEIC/HEIF) are typically 8–12MB each, so even a single mobile upload fails. HEIC is also unsupported by the Canvas API in non-WebKit browsers, ruling out purely client-side conversion. A correct cross-browser, cross-platform solution requires bypassing Vercel for the file transfer entirely.

---

## Solution: Presigned S3 PUT Uploads

The client uploads files directly to S3 using backend-generated presigned PUT URLs. Vercel never handles the file bytes. Conversion and compression move to the worker, where they run once before Textract.

---

## Upload Flow

1. **`POST /api/receipts/presign`** — client sends `{ jobId, files: [{ id, name, type }] }` where `id` is a client-generated UUID (`crypto.randomUUID()`). Backend verifies auth and job ownership, creates N `receipt_files` DB records (status: `pending`) using the client-provided UUID as the primary key (and thus the S3 key), returns `[{ receiptId, presignedUrl }]`.

2. **Client PUTs files directly to S3 in parallel** — one `fetch` PUT per file using the presigned URL. No Vercel involvement. Client matches presign response to files by `receiptId` (Map lookup), not by array position. Presigned URLs expire in **60 seconds** — generous for a direct PUT but short enough to limit misuse.

3. **`POST /api/receipts`** (confirm) — client sends `{ receiptIds: string[] }`. Backend verifies ownership and enqueues SQS for each.

### Why client-generated UUIDs

The client generates a UUID per file before the presign call, sends it as `id`, and the backend uses it as the actual `receiptFile.id` and S3 key. This means:
- The Map-based `receiptId` match is stable regardless of response ordering
- The DB record ID, S3 key, and the client's reference all share the same UUID
- No positional array matching anywhere in the flow

### Why presigned URLs

The web server (Vercel) holds S3 credentials, but presigned URLs let the browser upload directly to S3 without the server ever touching the file bytes. This is the standard pattern for bypassing proxy body limits. The URL is scoped to one specific PUT on one specific key — it can't be used to read other objects or write elsewhere.

---

## Worker Changes (Phase 1 — before Textract)

Raw files land in S3 unprocessed. Phase 1 adds a normalization step before calling Textract:

1. Download raw file from S3
2. If HEIC/HEIF (detected by **magic bytes** at offset 4–12, not MIME type): convert to JPEG using `heic-convert`
3. Resize and compress with `sharp` for **all** file types: `resize({ width: 1600, withoutEnlargement: true })` + `jpeg({ quality: 0.8 })`
4. Re-upload processed JPEG to the **same S3 key** (atomic overwrite) with `ContentType: 'image/jpeg'`
5. Call Textract with the processed key

S3 keys have no extension (see key format below), so there is nothing misleading after the worker overwrites the raw upload with a processed JPEG.

---

## Web Layer Changes

**`apps/web/server/services/storage.service.ts`**
- Added `generatePresignedPutUrl(key, contentType, expiresInSeconds = 60)` using the existing `@aws-sdk/s3-request-presigner`

**`apps/web/server/services/receipts.service.ts`**
- Added `presignReceiptUploads(jobId, files)` — accepts `{ id, name, type }[]` (client-provided UUIDs), creates DB records, returns presigned URLs
- Kept `persistReceiptFile` / `normalizeReceiptImage` for the manual upload tab (still goes through Vercel, single file, no size issue)

**API routes**
- `POST /api/receipts/presign` — presign endpoint. Schema lives in `app/api/receipts/presign/schema.ts` (shared with the frontend for type safety without importing server code into the client bundle)
- `POST /api/receipts` — confirm endpoint, accepts `{ receiptIds }`, enqueues SQS
- `DELETE /api/receipts` — unchanged

**S3 key format**

Keys use `receipts/{jobId}/{receiptFileId}` — no extension. The receipt DB record ID is the client-generated UUID, reused as the S3 object name. Extensions are omitted — S3 and Textract use `ContentType` metadata, not the filename, and the extension becomes actively misleading after the worker overwrites HEIC with JPEG.

**`apps/web/components/receipt-files/scan-upload-receipts.tsx`**

`onSubmit` flow:
1. Generate a UUID per file: `values.files.map(file => ({ id: crypto.randomUUID(), file }))`
2. Call `/api/receipts/presign` with `{ jobId, files: [{ id, name, type }] }`
3. Match response by `receiptId` via `Map` (not array index)
4. `await Promise.all(...)` — PUT each file to its presigned URL, increment `uploadedCount` in `finally`
5. Call `/api/receipts` confirm with `receiptIds`
6. Show progress bar (`uploadedCount / files.length`) during step 4
7. `beforeunload` guard active while `isSubmitting`

---

## S3 CORS Configuration

Only the presigned PUT requires CORS — `<img src>` fetches to S3 for image preview are no-cors and don't trigger CORS checks.

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["PUT"],
  "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
  "ExposeHeaders": ["ETag"]
}]
```

`AllowedHeaders: ["*"]` is required because the presigned PUT includes a `Content-Type` header.

---

## Sharp on AWS Lambda

Sharp is a native module (wraps libvips, compiled to a platform-specific `.node` binary). esbuild can bundle JavaScript but cannot inline native binaries, so sharp must be `--external` and physically present in the Lambda zip.

All other dependencies (`dotenv`, `@aws-sdk/*`, `heic-convert`, etc.) are pure JavaScript — esbuild inlines them into `dist/index.js` at build time. Those packages' `node_modules` entries are never needed at Lambda runtime.

### Why the deploy script installs sharp manually

pnpm uses symlinks in `node_modules/` (e.g. `apps/worker/node_modules/sharp -> ../../../node_modules/.pnpm/sharp@.../node_modules/sharp`). Lambda does not support symlinks in deployment packages — they'd be silently ignored at runtime.

CDK packages only `apps/worker/dist/`. So sharp must be installed as real files directly into `dist/node_modules/` before CDK zips that directory.

### Cross-platform binary requirement

`npm install sharp` on macOS installs `@img/sharp-darwin-arm64`. Lambda runs Linux. Three npm flags are all required together to get the Linux binary on a Mac:

```bash
npm install --cpu=arm64 --os=linux --libc=glibc sharp
```

- `--cpu` — which CPU architecture (matches your Lambda architecture: arm64 for M-series Mac)
- `--os=linux` — target OS (overrides macOS detection)
- `--libc=glibc` — C standard library (Lambda runs Amazon Linux 2023 = glibc; without this flag npm skips the optional binary entirely)

### Version pinning

The sharp version is hardcoded as `0.34.5` in three places:
- `apps/worker/scripts/deploy-local.sh`
- `.github/workflows/staging.yml`
- `.github/workflows/main.yml`

This must match the version declared in `packages/services/package.json` (`"sharp": "^0.34.5"`). When bumping sharp there, update all three deploy files to match.

The sharp entry in `packages/services/package.json` serves two purposes: TypeScript types during development, and the actual runtime binary when running the worker locally with `tsx dev.ts`. For the Lambda, the manually installed copy in `dist/node_modules/` is what executes — the pnpm-managed copy is never included in the zip.

### deploy-local.sh

After `npm run build`:
1. Detect host arch (`uname -m`) and map to npm's naming (`arm64`/`x64`)
2. `cd dist && echo '{}' > package.json` — the empty `package.json` stops npm from walking up to the monorepo root, which contains `workspace:*` deps npm can't parse
3. `npm install --cpu=$LINUX_ARCH --os=linux --libc=glibc sharp@0.34.5`
4. `rm -f package.json package-lock.json` — clean up before CDK zips `dist/`

### staging.yml / main.yml (CI)

CI runner is Ubuntu (Linux x64), so no cross-platform override is needed. Same pattern: install into `dist/` with an empty `package.json` sentinel, clean up after:

```yaml
- name: Bundle sharp for Lambda
  run: |
    cd apps/worker/dist
    echo '{}' > package.json
    npm install --cpu=x64 --os=linux --libc=glibc sharp@0.34.5
    rm -f package.json package-lock.json
```

---

## Removed Complexity

- No client-side HEIC conversion library (`heic2any`, WASM)
- No client-side compression (`browser-image-compression`)
- No batching — all uploads truly parallel
- `MAX_FILES_PER_UPLOAD` can be raised; the only remaining constraint is UX

---

## Edge Cases

- **Orphaned objects**: If the client uploads to S3 but crashes before calling `/confirm`, SQS is never enqueued and the receipt stays `pending` indefinitely. Acceptable at this scale; mitigatable later with an S3 lifecycle expiry rule on the `receipts/` prefix.
- **Failed worker normalization**: Corrupt or unsupported file causes `heic-convert`/`sharp` to throw → worker marks receipt `failed`. Raw file remains in S3 until a cleanup pass.
- **`/confirm` without verifying S3 existence**: Don't add a per-key existence check — just enqueue and let the worker report failure. The check adds latency on the happy path for no benefit.
- **Presigned URL expiry**: URLs expire in 60 seconds. Direct PUTs complete in seconds even for large files, so this is generous. Short expiry limits the window for URL misuse.
- **File size limit**: `MAX_FILE_SIZE_BYTES` (15 MB) is enforced in two places: (1) client-side via `maxSize` on the `<FileUpload>` component — rejected files never reach the presign call; (2) server-side via a `z.number().max(MAX_FILE_SIZE_BYTES)` guard on the `size` field in `PresignSchema` — the client sends `file.size` and the server rejects the entire presign request if any file exceeds the limit. The presigned PUT itself has no `ContentLengthRange` condition, so a tampered client could still PUT an oversized object directly; this is acceptable given the auth requirement.
