# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (run from repo root)
```bash
pnpm dev                # Start Next.js web dev server (http://localhost:3000)
pnpm build              # Build web for production
pnpm db:generate        # Generate Drizzle migration files from schema changes
pnpm db:migrate         # Run pending database migrations
pnpm db:studio          # Open Drizzle Studio GUI
```

### Worker (run from `apps/worker/`)
```bash
pnpm dev                # Run worker locally via tsx (for quick iteration)
pnpm build              # Bundle Lambda with esbuild → dist/index.js
pnpm deploy:local       # Build + deploy to LocalStack
pnpm send:test          # Send a test SQS message to trigger the worker
```

### Infrastructure
```bash
docker-compose up -d    # Start Postgres + Neon Proxy + LocalStack (required for local dev)
```

### Linting
```bash
pnpm --filter web lint  # ESLint for web app
```

There are no automated tests you can run in the standard way — test files (`*.test.ts`) exist in `packages/services/src/` but no test runner is configured in `package.json`.

## Architecture

This is a **pnpm monorepo** with two apps and three shared packages:

```
apps/web        — Next.js 16 frontend + API routes
apps/worker     — AWS Lambda handler (SQS-triggered receipt processor)
packages/db     — Drizzle ORM schema, migrations, and repository functions
packages/services — Core business logic (OCR, AI extraction, storage)
packages/shared — Zod validators, domain constants, shared types
```

### Receipt Processing Pipeline (2-Phase)

The central workflow is receipt ingestion and extraction:

1. **Web API** (`POST /api/receipts`) — receives uploaded files, converts HEIC→JPEG if needed, stores to S3, creates a `receipt_files_table` record, enqueues an SQS message with `{ receiptId }`.

2. **Worker Lambda** (`apps/worker/index.ts`) — receives SQS batch events, calls `processReceipt(receiptId)` for each.

3. **Phase 1 — OCR** (`packages/services/src/orchestration/phase1-processor.ts`) — calls AWS Textract `AnalyzeExpense` on the S3 object. Stores a `SlimOcrResult` (summaryFields + lineItems + rawText, no geometry, ~1–3 KB) into `ocr_results_table`. Updates receipt status: `pending → ocr_processing → ocr_complete`.

4. **Phase 2 — Extraction** (`packages/services/src/orchestration/phase2-processor.ts`) — reads the `SlimOcrResult`, builds a structured prompt, calls OpenAI `gpt-4o-mini` with JSON schema output. Saves structured data to `extracted_expenses_table`. Updates receipt status: `ocr_complete → extracting → complete`.

Status lifecycle: `pending → ocr_processing → ocr_complete → extracting → complete | failed`

Both phases are idempotent — re-running a message in any intermediate state safely resumes from the correct step. The worker reports per-message failures to SQS so only failed messages are retried.

### Database (`packages/db`)

- **Driver**: Neon serverless (`@neondatabase/serverless`) over HTTP. In local dev, the client routes through the Neon proxy on port 4444 (configured in `src/client.ts`).
- **Schema** (`src/schema/app.schema.ts`): Four main tables — `expense_report_jobs_table`, `receipt_files_table`, `ocr_results_table`, `extracted_expenses_table`. Auth tables are managed by Better Auth in `src/schema/auth.schema.ts`.
- **Repositories**: Thin wrappers in `src/repositories/` — these are the only DB access layer; nothing calls `db` directly from outside `@repo/db`.
- **Migrations**: Use `dotenv -e .env.migrations` so the migration `DATABASE_URL` (plain `postgres://` via port 5432) differs from the app `DATABASE_URL` (Neon HTTP via port 4444).
- **`isCurrent` flag** on `extracted_expenses_table`: A partial unique index (`uniq_active_receipt`) enforces one active extraction per receipt. Duplicate inserts are caught and silently ignored in the phase-2 processor.

### Web App (`apps/web`)

- **API layer**: Next.js App Router route handlers in `app/api/`. All routes are wrapped with `withProblems()` (`lib/problems/wrapper.ts`), which catches any thrown `ProblemDetails` objects and serialises them as RFC 9457 responses. Errors from the service layer are thrown as `ProblemDetails` (via `lib/problems/problem.ts`).
- **Auth**: Better Auth (`lib/auth/auth.ts`) with the `admin` plugin. New signups are **auto-banned** (pending approval) via a `databaseHooks.user.create.before` hook — admins must approve via `/admin/dashboard`. Google OAuth and email/password are both enabled.
- **Server services** (`server/services/`): Business logic for the web layer — receipt ingestion, S3 storage, SQS queue, export to Excel. These call `@repo/db` repositories and `@repo/shared` types.

### Environment Variables

Secrets live at `~/.config/secrets/expense-report.env` (loaded via `.envrc` if using direnv). Key variables: `DATABASE_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `OPENAI_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

The `S3_ENDPOINT` variable is optional — omit it to use real AWS S3; set it to `http://localhost:9000` for MinIO in local dev. The `forcePathStyle` S3 option is tied to whether `S3_ENDPOINT` is set.

### Infrastructure

The worker is deployed as an AWS Lambda triggered by SQS, managed via CDK (`apps/worker/infra/`). Local dev uses LocalStack. CDK outputs are written to `apps/worker/cdk-outputs.json`. The Lambda needs IAM permissions for `textract:AnalyzeExpense` and `s3:GetObject` on the receipts bucket.
