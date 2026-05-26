# SaaS Implementation Plan — Orgs, Flexible Schema & Schema-Aware Extraction

## Overview

This plan covers the architectural changes needed to transform the current single-user expense processor into a multi-tenant SaaS with:

- **Organizations** — every user belongs to at least one org (personal or team)
- **Flexible schema** — org admins define the exact fields they want extracted
- **Schema-aware extraction** — the AI pipeline adapts dynamically to each org's schema
- **Schema versioning** — jobs are frozen to the schema version active at creation time

See `docs/schema-v2.dbml` for the proposed database changes.

---

## Architectural Decisions (Locked)

### 1. Personal Org on Signup
Every new user gets a **personal org** auto-created at registration. There is no "individual user" mode — everything (jobs, schemas, receipts) belongs to an org. This keeps the data model uniform and makes upgrading to a team org trivial.

### 2. Better Auth Organization Plugin
Use the [Better Auth organization plugin](https://www.better-auth.com/docs/plugins/organization) for org creation, membership, roles, and invitations. This gives `organizations`, `members`, and `invitations` tables out of the box. Custom schema config tables live alongside these, linked by `org_id`.

### 3. Schema Versioning (Snapshot on Job Creation)
When a job is created, the currently active `schema_version_id` is recorded on the job. Extraction and display always use that frozen version. Admin schema changes only affect future jobs — existing jobs are never broken by schema updates.

### 4. Hybrid Typed + JSONB Extracted Data
`amount` (decimal) and `date` (date) are typed columns on `extracted_expenses_table` — they are universal, always required, and needed for DB-level aggregation, sorting, and filtering. All other fields (merchant, category, org-specific fields) live in an `extracted_fields` JSONB column, keyed by the field's `key` from the schema version.

### 5. System Fields
Every schema implicitly includes `amount` and `date` as non-removable system fields. Org admins can configure everything else. This avoids special-casing in the extraction pipeline while ensuring financial data is always queryable.

---

## Phase 1 — Org Foundation

**Goal:** Every user is in an org. All jobs are scoped to an org.

### 1.1 Enable Better Auth Organization Plugin

Add `organization()` to the Better Auth config in `apps/web/lib/auth/auth.ts`:

```typescript
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  // ...existing config
  plugins: [
    adminPlugin(),
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],
});
```

Run `pnpm auth:generate` to generate the new `organizations`, `members`, and `invitations` tables in `auth.schema.ts`.

### 1.2 Auto-Create Personal Org on Signup

Hook into `databaseHooks.user.create.after` (same place as the auto-ban hook) to:
1. Create an org with `slug = user.id`, `name = "{user.name}'s Workspace"`
2. Add the user as `owner` of that org
3. Store `personalOrgId` on the user record (add a column to `users` or resolve by convention)

```typescript
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        const org = await createOrganization({ name: `${user.name}'s Workspace`, slug: user.id });
        await addMember({ orgId: org.id, userId: user.id, role: "owner" });
      }
    }
  }
}
```

### 1.3 Schema Migration — Add `org_id` to Jobs

```sql
-- Add org_id to expense_report_jobs_table
ALTER TABLE expense_report_jobs_table
ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill: assign existing jobs to the creator's personal org
-- (personal org slug = user_id, so we can look it up)
UPDATE expense_report_jobs_table j
SET org_id = (
  SELECT o.id FROM organizations o WHERE o.slug = j.user_id::text
);

-- Make non-nullable after backfill
ALTER TABLE expense_report_jobs_table
ALTER COLUMN org_id SET NOT NULL;
```

### 1.4 Update All Queries to Scope by Org

All repository functions that list or access jobs must add an `org_id` filter. No query should return cross-org data. Audit every function in `packages/db/src/repositories/` — this is the security-critical step.

### 1.5 Session — Active Org Context

Use the Better Auth organization plugin's `activeOrganizationId` session field. On login, default to the user's personal org. The session-aware auth helpers in `apps/web/lib/auth/` need to pass `orgId` down to all service calls.

---

## Phase 2 — Schema Configuration

**Goal:** Org admins can define a set of fields that the AI should extract for their org.

### 2.1 New Tables

Add to `packages/db/src/schema/app.schema.ts` (see `schema-v2.dbml` for full definitions):

- **`org_schemas`** — one schema config per org (an org can have multiple but only one active at a time)
- **`schema_versions`** — immutable snapshots; every edit to an active schema creates a new version

### 2.2 Seed Default Schema on Org Creation

When a personal org is auto-created (Phase 1.2), also seed a default schema version with:

```json
[
  { "key": "merchant",    "label": "Merchant",     "type": "text",   "required": false, "extractable": true,  "displayOrder": 1 },
  { "key": "description", "label": "Description",  "type": "text",   "required": false, "extractable": true,  "displayOrder": 2 },
  { "key": "category",    "label": "Category",     "type": "enum",   "required": true,  "extractable": true,  "displayOrder": 3,
    "options": ["tolls/parking","hotel","transport","fuel","meals","phone","supplies","misc"] },
  { "key": "transport_mode",    "label": "Transport Mode",   "type": "enum",   "required": false, "extractable": true,  "displayOrder": 4,
    "options": ["train","car","plane"] },
  { "key": "mileage",     "label": "Mileage",      "type": "number", "required": false, "extractable": true,  "displayOrder": 5 }
]
```

This matches the current hardcoded schema exactly, so no behavioural change for existing users.

### 2.3 Schema Field Types

The supported field types for v1:

| Type | Description | AI Extractable? |
|---|---|---|
| `text` | Single-line string | ✅ |
| `number` | Decimal or integer | ✅ |
| `date` | ISO date | ✅ |
| `boolean` | Yes/No checkbox | ✅ (contextual) |
| `enum` | Single-select from options list | ✅ |
| `multi_select` | Multi-select from options list | ⚠️ (limited) |

Fields marked `extractable: false` are skipped by the AI and surfaced as "needs your input" in the review UI. They are always filled in by the employee (e.g., project code, cost center).

### 2.4 Schema Version Immutability Rule

A `schema_version` is **never updated** once created. Editing an active schema:
1. Creates a new `schema_version` record with `version_number + 1` and the updated fields
2. Updates `org_schemas.active_version_id` to point to the new version
3. All future jobs pick up the new version; all past jobs retain the old version

Enforce this at the repository layer — no UPDATE on `schema_versions`.

### 2.5 Complexity Cap (v1)

- Max **20 fields** per schema (including system fields)
- Max **30 enum options** per field
- Field `key` must match `^[a-z][a-z0-9_]{0,39}$` and be unique within the schema

### 2.6 Admin Schema Builder UI

Admin-only page at `/org/settings/schema`:
- List existing fields with drag-to-reorder
- Add field: choose type, set label (key auto-generated), mark required + extractable, add options (for enum)
- Edit field: change label, options, required flag (key is immutable after creation)
- Delete field: only allowed if no jobs reference the current version (or warn that it affects future jobs only)
- Publish: saves as a new version, with confirmation showing "X future jobs will use this schema"

---

## Phase 3 — Schema-Aware Extraction Pipeline

**Goal:** Phase 2 of the processing pipeline reads the job's schema version and dynamically builds the extraction prompt and JSON schema.

### 3.1 Thread Schema Version Through the Pipeline

The SQS message payload currently carries `{ receiptId }`. Add `{ receiptId, schemaVersionId }` — or look it up from the job at the start of processing.

```typescript
// In phase2-processor.ts
const job = await getJobByReceiptId(receiptId);
const schemaVersion = await getSchemaVersion(job.schemaVersionId);
```

### 3.2 Dynamic Prompt Builder

Replace the static `buildPrompt()` function with a schema-aware version:

```typescript
function buildExtractionPrompt(ocr: SlimOcrResult, fields: SchemaFieldDefinition[]): string {
  const extractableFields = fields.filter(f => f.extractable);
  
  const fieldDescriptions = extractableFields.map(f => {
    const typeHint = f.type === "enum" ? `one of: ${f.options?.join(", ")}` : f.type;
    return `- "${f.key}" (${f.label}): ${typeHint}${f.required ? " [required]" : " [optional, null if not found]"}`;
  }).join("\n");
  
  return `Extract the following fields from the receipt:\n${fieldDescriptions}\n\n${buildOcrSection(ocr)}`;
}
```

### 3.3 Dynamic JSON Schema for OpenAI

Build the `json_schema` output constraint at runtime from the schema version fields instead of using the hardcoded Zod schema:

```typescript
function buildJsonSchema(fields: SchemaFieldDefinition[]): object {
  const properties: Record<string, object> = {
    amount: { type: "number" },   // system field, always present
    date:   { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },  // system field
  };
  const required: string[] = ["amount", "date"];

  for (const field of fields.filter(f => f.extractable)) {
    properties[field.key] = fieldToJsonSchemaType(field);
    if (field.required) required.push(field.key);
  }

  return { type: "object", properties, required, additionalProperties: false };
}
```

### 3.4 `extracted_expenses_table` — Schema Migration

This is the most impactful migration. The typed columns (`merchant`, `description`, `category`, `transport_details`) are removed and replaced by `extracted_fields` JSONB.

```sql
-- Step 1: Add new columns
ALTER TABLE extracted_expenses_table
ADD COLUMN schema_version_id UUID REFERENCES schema_versions(id) ON DELETE SET NULL,
ADD COLUMN extracted_fields JSONB;

-- Step 2: Migrate existing data into JSONB (backfill)
UPDATE extracted_expenses_table
SET extracted_fields = jsonb_build_object(
  'merchant',         merchant,
  'description',      description,
  'category',         category::text,
  'transport_details', transport_details
);

-- Step 3: Drop typed columns (after backfill verified)
ALTER TABLE extracted_expenses_table
DROP COLUMN merchant,
DROP COLUMN description,
DROP COLUMN category,
DROP COLUMN transport_details;
```

The `amount` and `date` columns are **retained** as typed columns.

### 3.5 Updated Extraction Output Shape

```typescript
// New createExtractedExpense call in phase2-processor.ts
await createExtractedExpense({
  receiptId,
  ocrResultId:      ocrResult.id,
  schemaVersionId:  schemaVersion.id,
  amount:           result.data.amount,       // typed column
  date:             result.data.date,         // typed column
  extractedFields:  omit(result.data, ["amount", "date"]),  // everything else → JSONB
  rawJson:          result.data,
  modelVersion:     "gpt-4o-mini",
});
```

### 3.6 Validation at Save Time

Before inserting, validate `extractedFields` against the schema version fields:
- All `required: true` fields are present and non-null
- Enum values are within the allowed `options` list
- Number fields are numeric

Validation failures do not block the save — they are surfaced as warnings in the review UI so the employee can correct them.

---

## Phase 4 — Schema-Aware UI

**Goal:** The review and export UI render dynamically based on the schema version attached to the job.

### 4.1 Receipt Review UI

The current review UI has hardcoded field names. Replace with a loop over `schemaVersion.fields`:

```tsx
{schemaVersion.fields.map(field => (
  <FieldInput
    key={field.key}
    field={field}
    value={extractedFields[field.key]}
    autoExtracted={field.extractable}
    onChange={...}
  />
))}
```

Fields with `extractable: false` render with a "fill in required" indicator (not pre-populated). Fields with `extractable: true` render the AI value with an edit affordance.

### 4.2 Export — Dynamic Columns

The Excel export currently has hardcoded column names. Update to:
1. Load the schema version for the job
2. Generate columns: `Date`, `Amount`, then one column per schema field in `displayOrder`
3. Map `extractedFields[field.key]` to each column

### 4.3 Job Creation

When the user creates a new job, the API:
1. Looks up the org's active `schema_version_id`
2. Records it on the job at creation time
3. No user interaction required — this is automatic

### 4.4 Admin Schema Version History

In `/org/settings/schema`, show version history:
- List all past versions with creation date, creator, and number of jobs using that version
- Allow admin to "view" a past version (read-only)
- No rollback — if the admin wants to go back, they create a new version matching the old fields

---

## Phase 5 — Team Support (Post-MVP)

> These features are not needed before the first real users. Personal orgs cover all solo use cases.

- [ ] Email invitations (requires email service integration)
- [ ] Role-based access: members see jobs/receipts, admins see schema settings
- [ ] Org switcher in sidebar (already partially scaffolded by `TeamSwitcher` component)
- [ ] Shared jobs within an org (multiple members contributing receipts to one report)
- [ ] Usage dashboard per org

---

## Phase 6 — Free Tier & Rate Limiting (Post-MVP)

> Design the model now so the table structure is in place. Enforcement is not needed until you have real users.

### Usage Tracking

Add `org_usage` table (see `schema-v2.dbml`):

```typescript
// Increment on every successful extraction
await incrementOrgUsage(orgId, period: "2025-05");
```

### Suggested Free Tier

| Tier | Price | Receipts/month | Schema fields | Team members |
|---|---|---|---|---|
| Free | $0 | 25 | 10 | 1 (personal only) |
| Starter | $12/mo | 200 | 20 | 5 |
| Team | $39/mo | 1000 | 20 | 25 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

Enforcement: check `org_usage` before enqueueing each receipt. Return a `429 Too Many Requests` with a clear message if over limit.

---

## Implementation Order (Critical Path to First Real User)

```
Phase 1.1  Enable Better Auth org plugin
Phase 1.2  Auto-create personal org on signup
Phase 2.1  Add org_schemas + schema_versions tables
Phase 2.2  Seed default schema on org creation
Phase 1.3  Add org_id to jobs table + backfill
Phase 1.4  Scope all queries by org_id
Phase 1.5  Pass active org through session
Phase 2.3  Schema builder UI (admin)
Phase 3.1  Thread schema_version_id through pipeline
Phase 3.2  Dynamic prompt builder
Phase 3.3  Dynamic JSON schema for OpenAI
Phase 3.4  Migrate extracted_expenses (typed → JSONB)
Phase 3.5  Updated extraction output shape
Phase 4.1  Dynamic review UI
Phase 4.2  Dynamic export
─────────────────────────────────────────
         ↑ FIRST REAL USER CAN USE THIS ↑
─────────────────────────────────────────
Phase 5   Team invitations + roles
Phase 6   Free tier enforcement + billing
```

---

## Open Questions

1. **Schema key immutability** — once a field `key` is used in extracted data, can it ever be renamed? Proposed: no (only add new fields or deprecate old ones by marking hidden).
2. **Non-extractable required fields** — if a field is `required: true` and `extractable: false` (e.g., project code), should the receipt be held in a "pending employee input" state rather than "complete"? Probably yes.
3. **Multi-org users** — can a user belong to more than one org (e.g., a contractor)? Better Auth supports it natively. Defer to Phase 5 to keep it simple.
4. **Schema import** — can an admin upload their existing Excel template and have the system infer the schema fields? Compelling feature, but complex — backlog for post-MVP.
