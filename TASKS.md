# Tasks

## In Progress

- [ ] Hydration Error - React hydration mismatch in sidebar components
  - Server/client ID mismatch in Radix UI components
  - Affects: `TeamSwitcher`, `SidebarMenuButton`, `AppSidebar`
  - Location: `components/ui/sidebar.tsx:515`

## Backlog

### Critical Bug Fixes (High Priority)

- [ ] OpenAI 429 Error Handling & Rate Limiting
  - **Problem**: OpenAI returns 429 errors when processing many files consecutively
  - **Issue**: `@packages/services/src/process.ts` swallows these errors
  - **Impact**: Receipts get stuck in "processing" phase indefinitely
  - **Solution**:
    - Implement exponential backoff with jitter for OpenAI API calls
    - Add proper error handling to convert stuck receipts to "failed" status
    - Consider using p-limit or bottleneck for concurrency control
    - Add DLQ (Dead Letter Queue) handling for failed messages
    - Update `processReceipt()` to catch and properly handle 429 errors

- [ ] Error Transparency in Receipt Processing
  - **Problem**: Processing errors are swallowed silently
  - **Solution**:
    - Ensure all errors bubble up to UI with meaningful messages
    - Add error logging/monitoring (consider Sentry or similar)
    - Show failure reason in the UI for failed receipts

### High Priority

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

_None yet_

---

## Notes

- Using this file for AI-managed task tracking instead of Notion
- Tasks are organized by priority and complexity
- Check off items as they are completed
- Add new tasks to appropriate section
- Critical bugs should be prioritized over new features
