# SaaS Implementation Plan — Flexible Schema & Schema-Aware Extraction

## Overview

This plan covers the architectural changes needed to evolve the current single-user expense processor into a product with:

- **Flexible schema** — each user defines the exact fields they want extracted
- **Schema-aware extraction** — the AI pipeline adapts dynamically to each user's schema
- **Schema versioning** — jobs are frozen to the schema version active at creation time

**Multi-tenant organizations are explicitly out of scope for this version.** Schema ownership, job ownership, and everything else is scoped to `user_id`. Team accounts, shared schemas, roles, and invitations are deferred to Phase 4 (post-MVP). See Decision 1 for why.

The AI-assisted "upload your existing Excel/CSV template and infer a schema" importer discussed alongside this plan is also **not** part of this version — it's backlogged pending validation that the core schema-editor + extraction workflow has real demand.

See `docs/saas/v2/schema-v2.dbml` for the proposed database changes.

---

## Architectural Decisions (Locked)

### 1. User-Scoped Schema; Orgs Deferred

Schema configuration, schema versioning, and job ownership are scoped to `user_id`, not to an organization. This version does **not** enable the Better Auth organization plugin and does **not** introduce `organizations`, `members`, or `invitations` tables.

Reasoning: organizations are cheap to retrofit later — adding them means new additive tables plus one nullable FK column each on `expense_report_jobs_table` and `schemas_table`, backfilled with a mechanical script (create one personal org per existing user, point their rows at it). By contrast, the schema-versioning and schema-aware extraction pipeline — the part this version is actually validating — is expensive to retrofit, since it's threaded through the prompt builder, the JSON schema builder, the review UI, and export. Building org infrastructure now would spend effort on an unvalidated feature (team usage) before the core premise (does anyone want configurable-schema extraction at all) has real users. See Phase 4 for the deferred org work and the migration path.

### 2. Schema Versioning (Snapshot on Job Creation)

When a job is created, the user's currently active `schema_version_id` is recorded on the job. Extraction and display always use that frozen version. Schema edits only affect future jobs — existing jobs are never broken by schema updates.

### 3. Hybrid Typed + JSONB Extracted Data

`amount` (decimal) and `date` (date) are typed columns on `extracted_expenses_table` — they are universal, always required, and needed for DB-level aggregation, sorting, and filtering. All other fields (merchant, category, user-defined fields) live in an `extracted_fields` JSONB column, keyed by the field's `key` from the schema version.

### 4. System Fields

Every schema implicitly includes `amount` and `date` as non-removable system fields. Users can configure everything else. This avoids special-casing in the extraction pipeline while ensuring financial data is always queryable. `amount` and `date` are also valid `showWhen.field` references (see Decision 7) — they aren't just reserved keys, they're usable conditions.

### 5. Clean Database Start

No data migration will be written. A new Neon database is used from the start with this schema as its initial state. Existing receipts (currently just the test user's data) will be re-uploaded after the new schema is live. Because there is no migration, there are no "legacy row" cases to design around — `schema_version_id` and `extracted_fields` can be `NOT NULL` from day one rather than nullable for backward compatibility.

### 6. Flat Storage; Groups Are a Pure Visual Concept

`extracted_fields` JSONB is always a **flat key-value map** — no nested objects. This keeps extraction simple (the AI outputs one flat object) and export simple (one column per field). UI grouping (e.g., a "Transport Details" section) is expressed via optional `groupId` metadata on field definitions, not via nested storage.

A group has **no visibility condition of its own** — it is purely a label + description used to visually cluster fields that share a `groupId`. A group's fieldset renders if and only if at least one of its member fields currently evaluates visible via that field's own `showWhen`; it is hidden if all member fields are hidden. This was simplified from an earlier draft that gave groups their own `showWhen` in addition to each field's `showWhen` — that was redundant in every case in the seed schema (the group condition was always identical to its members' conditions) and created a real risk of the two silently disagreeing. Deriving group visibility from member visibility removes an entire class of bug for free and is strictly less to build.

### 7. `description` is User-Facing Only; AI Prompt Uses Structured Metadata

Field definitions have a `description` property (user-authored, shown as a tooltip in the review UI). The AI extraction prompt is built entirely from structured field metadata (`type`, `options`, `required`, `showWhen`) — never from freeform user text. This avoids prompt injection risk, keeps the AI prompt deterministic, and separates the two concerns cleanly. `showWhen` conditions are translated into explicit natural-language constraints in the prompt (e.g., "only fill `transport_mode` if `category` equals `transport`, otherwise return null").

### 8. Non-Extractable Required Fields Hold the Receipt in `needs_review`

A field can be `required: true` and `extractable: false` at the same time (e.g., a project code only the employee knows — nothing on the receipt can fill it). When phase 2 extraction completes and any such field is still empty, the receipt does **not** move to `complete`. It moves to a new terminal status, `needs_review`. The receipt only reaches `complete` once the user supplies values for all required fields via the review UI and saves.

Updated status lifecycle:

```
pending → ocr_processing → ocr_complete → extracting → complete | needs_review | failed
                                                              needs_review → complete (on user save)
```

Both phases remain idempotent; `needs_review` behaves like `complete` for pipeline purposes (processing is done) but signals the UI to keep the receipt in an actionable "needs your input" list rather than treating it as finished.

### 9. Confidence Flags Extend `needs_review` Beyond Missing Fields

Decision 8 already sends a receipt to `needs_review` when a required field is null. This is extended with two additional confidence signals, both purely mechanical — deliberately **not** OpenAI's self-reported per-field confidence, which is known to be poorly calibrated (LLMs are bad at introspecting their own uncertainty, and a claimed score doesn't reliably track actual correctness):

1. **Textract field-level confidence passthrough.** AWS Textract's `AnalyzeExpense` already returns a real, mathematical per-field `Confidence` (0–100) for summary fields, and it already survives into `SlimOcrResult.summaryFields[].confidence` (see `textract.service.ts`) — it's just never used downstream today. For schema fields that map to a known Textract summary field type via a small static lookup (starting set: `amount → TOTAL`, `date → INVOICE_RECEIPT_DATE`, `merchant → VENDOR_NAME`), a confidence below a threshold flags that field. This mapping is a code-level constant, not a user-configurable schema property — it only covers fields Textract was capable of detecting in the first place. Arbitrary custom fields (`project_code`, `cost_center`, …) have no Textract signal and don't get this flag.
2. **Amount cross-check.** The model's extracted `amount` is compared against Textract's own detected `TOTAL` summary field value. A mismatch beyond a small rounding tolerance flags `amount` — deterministic, free, and applied to the single most financially important field.
3. **Null on a required field** (Decision 8, restated here as the third confidence signal) — the model's own admission it couldn't find something required.

Signals 1–2 are computed at Phase 2.6/2.7 and persisted as `confidence_flags` (a flat `{ fieldKey: reason }` JSONB map) on `extracted_expenses_table`. `needs_review` triggers when a **required** field is either null or present in `confidence_flags`. Flags on *optional* fields are still stored and shown as a soft warning in the review UI, but do not force `needs_review` — scoping the trigger to required fields avoids flooding the review queue with noise on fields that don't block completion.

Explicitly deferred: logprobs-based per-field confidence from OpenAI (a real signal, unlike self-reported confidence, but requires correlating token spans to JSON field paths and calibrating thresholds against ground truth this product doesn't have yet). Revisit once there's enough real usage to calibrate against.

---

## Phase 1 — Schema Configuration

**Goal:** Users can define a set of fields that the AI should extract for them.

### 1.1 New Tables

Add to `packages/db/src/schema/app.schema.ts` (see `schema-v2.dbml` for full definitions):

- **`schemas_table`** — one schema config per user (a user can have multiple but only one active at a time). Named generically rather than `user_schemas_table` because the ownership axis is expected to shift toward org-scoping in Phase 4 — see Decision 1 and the Phase 4 migration note.
- **`schema_versions_table`** — immutable snapshots; every edit to an active schema creates a new version

### 1.2 Seed Default Schema on User Creation

When a new user signs up, seed a default schema version. A schema version consists of a `groups` array (for UI display only — see Decision 6) and a flat `fields` array (used for storage and extraction). This matches the current hardcoded schema exactly.

```json
{
  "groups": [
    {
      "id": "transport_details",
      "label": "Transport Details",
      "description": "Transport-specific details regarding your receipt"
    }
  ],
  "fields": [
    {
      "key": "merchant",
      "label": "Merchant",
      "type": "text",
      "required": false,
      "extractable": true,
      "displayOrder": 1,
      "description": null,
      "groupId": null,
      "showWhen": null
    },
    {
      "key": "description",
      "label": "Description",
      "type": "text",
      "required": false,
      "extractable": true,
      "displayOrder": 2,
      "description": null,
      "groupId": null,
      "showWhen": null
    },
    {
      "key": "category",
      "label": "Category",
      "type": "enum",
      "required": true,
      "extractable": true,
      "displayOrder": 3,
      "description": null,
      "groupId": null,
      "showWhen": null,
      "options": [
        "tolls/parking",
        "hotel",
        "transport",
        "fuel",
        "meals",
        "phone",
        "supplies",
        "misc"
      ]
    },
    {
      "key": "transport_mode",
      "label": "Transport Mode",
      "type": "enum",
      "required": false,
      "extractable": true,
      "displayOrder": 4,
      "description": "The primary mode of transport used",
      "groupId": "transport_details",
      "showWhen": { "field": "category", "op": "eq", "value": "transport" },
      "options": ["train", "car", "plane"]
    },
    {
      "key": "mileage",
      "label": "Mileage",
      "type": "number",
      "required": false,
      "extractable": true,
      "displayOrder": 5,
      "description": "Distance travelled in miles",
      "groupId": "transport_details",
      "showWhen": { "field": "category", "op": "eq", "value": "transport" }
    }
  ]
}
```

Key points:

- `showWhen` lives **only on fields**, never on groups (Decision 6). The `transport_details` group above has no condition of its own — it renders because `transport_mode` and/or `mileage` are currently visible, not because of anything stored on the group.
- `showWhen` on a field controls both its individual UI visibility and generates an AI prompt constraint
- `extracted_fields` in the DB is always flat: `{ "transport_mode": "train", "mileage": 120, ... }` — no nesting

### 1.3 Schema Field Definition

Every field in `fields[]` has the following shape:

| Property       | Type               | Description                                                                          |
| -------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `key`          | `string`           | Unique snake_case identifier. Immutable after creation. Reserved: `amount`, `date`.  |
| `label`        | `string`           | Display name shown in the UI form and export column header.                          |
| `type`         | `enum`             | One of: `text`, `number`, `date`, `boolean`, `enum`, `multi_select`                  |
| `required`     | `boolean`          | If true, receipt stays in `needs_review` until filled (see Decisions 8–9).           |
| `extractable`  | `boolean`          | If true, AI attempts extraction. If false, field is left blank for the user to fill. |
| `options`      | `string[] \| null` | Required for `enum` and `multi_select` types. Max 30 options.                        |
| `displayOrder` | `number`           | Render order in UI and export.                                                       |
| `description`  | `string \| null`   | **User-facing only.** Shown as a tooltip on hover in the review UI. Not sent to AI.  |
| `groupId`      | `string \| null`   | If set, field is rendered inside the named group's fieldset section.                 |
| `showWhen`     | `ShowWhen \| null` | Conditional visibility. Controls UI rendering and generates an AI prompt constraint. |

**`ShowWhen` shape (v1):**

```typescript
interface ShowWhen {
  field: string; // key of another field in this schema, OR the reserved system keys "amount" / "date"
  op: "eq" | "neq" | "in";
  value: string | string[]; // string for eq/neq, string[] for in
}
```

`field` may reference `amount` or `date` even though those are typed columns rather than entries in `fields[]` — both the client-side UI evaluator and the server-side AI prompt translator must resolve `field` against the merged value set `{ amount, date, ...extractedFields }`, not `extractedFields` alone. Since `amount`/`date` are already reserved keys (no user-defined field can use them), there's no collision risk.

**Known v1 limitations of `showWhen`** (deliberately not built yet — would require extending the condition "engine" itself, not just adding a field):

- **No compound conditions.** Each field's `showWhen` can reference exactly one other field. There's no way to express "show `mileage` only if `category = transport` AND `transport_mode = car`" — the seed schema above sidesteps this by keying `mileage` off `category` alone, which is looser than ideal but sufficient for v1.
- **No comparison operators.** Only `eq`/`neq`/`in` (equality-based) exist — no `gt`/`lt`/`between`. This means making `amount` referenceable (above) is necessary but not sufficient for the common "require justification if amount > $500" pattern; that needs comparison operators too, which are deferred.
- **No cycle detection.** Nothing currently stops `fieldA.showWhen` depending on `fieldB` while `fieldB.showWhen` depends on `fieldA`. Deferred, but flagged here as a cheap addition to the Complexity Cap validation (1.5) whenever it's picked up — reject at publish time if the field dependency graph has a cycle.

If/when compound conditions are needed, the natural backward-compatible extension is letting `showWhen` be either today's single-condition object or an `{ all: [...] } | { any: [...] }` wrapper around a list of them — existing single-condition schemas would still parse unchanged.

**Group definition shape:**

```typescript
interface FieldGroup {
  id: string;
  label: string; // rendered as fieldset legend in review UI
  description: string | null; // rendered below the legend
}
```

No `showWhen` on groups — see Decision 6.

**Supported field types:**

| Type           | AI Extractable? | Notes                                      |
| -------------- | --------------- | ------------------------------------------ |
| `text`         | ✅              | Single-line string                         |
| `number`       | ✅              | Decimal or integer                         |
| `date`         | ✅              | ISO 8601 `YYYY-MM-DD`                      |
| `boolean`      | ✅ (contextual) | Yes/No; AI infers from context             |
| `enum`         | ✅              | Single-select from `options` list          |
| `multi_select` | ⚠️ (limited)    | AI may not reliably select multiple values |

Fields with `extractable: false` are skipped by the AI entirely and surfaced as "needs your input" in the review UI (e.g., project codes, cost centres that only the user knows).

### 1.4 Schema Version Immutability Rule

A `schema_version` is **never updated** once created. Editing an active schema:

1. Creates a new `schema_version` record with `version_number + 1` and the updated fields
2. Updates `schemas_table.active_version_id` to point to the new version
3. All future jobs pick up the new version; all past jobs retain the old version

Enforce this at the repository layer — no UPDATE on `schema_versions_table`.

### 1.5 Complexity Cap (v1)

- Max **20 fields** per schema (including system fields)
- Max **30 enum options** per field
- Field `key` must match `^[a-z][a-z0-9_]{0,39}$` and be unique within the schema

### 1.6 Schema Builder UI

Page at `/settings/schema` (no admin-role gating needed — it's the user's own schema):

- List existing fields with drag-to-reorder
- Add field: choose type, set label (key auto-generated), mark required + extractable, add options (for enum)
- Edit field: change label, options, required flag (key is immutable after creation)
- Delete field: only allowed if no jobs reference the current version (or warn that it affects future jobs only)
- Publish: saves as a new version, with confirmation showing "X future jobs will use this schema"

---

## Phase 2 — Schema-Aware Extraction Pipeline

**Goal:** Phase 2 of the processing pipeline reads the job's schema version and dynamically builds the extraction prompt and JSON schema.

### 2.1 Thread Schema Version Through the Pipeline

The SQS message payload carries `{ receiptId }`. Look up the schema version from the job at the start of processing — no payload change needed.

```typescript
// In phase2-processor.ts
const job = await getJobByReceiptId(receiptId);
const schemaVersion = await getSchemaVersion(job.schemaVersionId);
```

### 2.2 Dynamic Prompt Builder

The prompt is built entirely from structured field metadata — never from freeform user text. `showWhen` conditions are translated into explicit natural-language constraints so the model knows which fields are conditional.

```typescript
function buildFieldConstraint(field: SchemaFieldDefinition): string {
  const typeHint =
    field.type === "enum"
      ? `one of [${field.options?.join(", ")}]`
      : field.type;

  const requiredHint = field.required
    ? "[required]"
    : "[optional — return null if not found or not applicable]";

  // Translate showWhen → explicit AI instruction
  const conditionHint = field.showWhen
    ? `Only extract if ${field.showWhen.field} ${showWhenToEnglish(field.showWhen)}; otherwise return null.`
    : "";

  return [
    `- "${field.key}" (${field.label}): ${typeHint} ${requiredHint}`,
    conditionHint,
  ]
    .filter(Boolean)
    .join(" ");
}

function showWhenToEnglish(condition: ShowWhen): string {
  if (condition.op === "eq") return `equals "${condition.value}"`;
  if (condition.op === "neq") return `does not equal "${condition.value}"`;
  if (condition.op === "in")
    return `is one of [${(condition.value as string[]).join(", ")}]`;
  return "";
}

function buildExtractionPrompt(
  ocr: SlimOcrResult,
  fields: SchemaFieldDefinition[],
): string {
  const extractableFields = fields.filter((f) => f.extractable);
  const fieldConstraints = extractableFields
    .map(buildFieldConstraint)
    .join("\n");

  return [
    "Extract the following fields from the receipt.",
    "Return null for any optional field that cannot be determined from the receipt.",
    "",
    "Fields:",
    fieldConstraints,
    "",
    buildOcrSection(ocr),
  ].join("\n");
}
```

### 2.3 Dynamic JSON Schema for OpenAI

Build the `json_schema` output constraint at runtime from the schema version fields instead of using the hardcoded Zod schema.

**Important:** OpenAI's strict `json_schema` mode requires every property to appear in `required` — optionality is expressed via a `["<type>", "null"]` type union, not by omitting the key from `required`. A schema that puts only `required: true` fields into the `required` array will be rejected by the API.

```typescript
function fieldToJsonSchemaType(field: SchemaFieldDefinition): object {
  const base = fieldTypeToJsonSchemaType(field.type); // e.g. { type: "string" } or { type: "string", enum: field.options }
  if (field.required) return base;
  // strict mode: optional fields are nullable unions, not omitted from `required`
  return { ...base, type: [base.type, "null"].flat() };
}

function buildJsonSchema(fields: SchemaFieldDefinition[]): object {
  const properties: Record<string, object> = {
    amount: { type: "number" }, // system field, always present
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, // system field
  };
  // strict mode: ALL properties go in `required`, including optional ones
  const required: string[] = ["amount", "date"];

  for (const field of fields.filter((f) => f.extractable)) {
    properties[field.key] = fieldToJsonSchemaType(field);
    required.push(field.key);
  }

  return { type: "object", properties, required, additionalProperties: false };
}
```

### 2.4 `extracted_expenses_table` — No Migration Required

Because we are starting with a clean database (Decision 5), this is the table's **initial state**. There are no typed columns to drop, no JSONB backfill to write, and no legacy rows to handle — `schema_version_id` and `extracted_fields` are `NOT NULL` from day one.

The table is defined with:

- `amount` decimal — typed system field
- `date` date — typed system field (nullable: OCR/extraction may not confidently determine a date from a given receipt)
- `extracted_fields` jsonb, `NOT NULL` — all user-defined fields (flat key-value map)
- `schema_version_id` uuid, `NOT NULL` — reference to the schema version that produced this row
- `confidence_flags` jsonb, `NOT NULL` — see 2.7

### 2.5 Updated Extraction Output Shape

```typescript
// New createExtractedExpense call in phase2-processor.ts
await createExtractedExpense({
  receiptId,
  ocrResultId: ocrResult.id,
  schemaVersionId: schemaVersion.id,
  amount: result.data.amount, // typed column
  date: result.data.date, // typed column
  extractedFields: omit(result.data, ["amount", "date"]), // everything else → JSONB
  confidenceFlags, // see 2.7
  rawJson: result.data,
  modelVersion: "gpt-4o-mini",
});
```

### 2.6 Validation at Save Time

Before inserting, validate `extractedFields` against the schema version fields:

- Enum values are within the allowed `options` list
- Number fields are numeric
- All `required: true` fields are present and non-null — if not, this is expected for non-extractable required fields (Decision 8) and is not an error condition

Validation failures for populated fields (e.g., an enum value outside `options`) do not block the save — they are surfaced as warnings in the review UI so the user can correct them. Combined with 2.7's confidence flags, this determines the receipt's terminal status.

### 2.7 Confidence Signals

Computed alongside 2.6's validation, using the mechanical signals from Decision 9 (deliberately not self-reported OpenAI confidence):

```typescript
// Static, code-level — not a user-configurable schema property. Only
// covers fields Textract is actually capable of detecting.
const TEXTRACT_FIELD_MAP: Partial<Record<string, string>> = {
  amount: "TOTAL",
  date: "INVOICE_RECEIPT_DATE",
  merchant: "VENDOR_NAME",
};

const LOW_CONFIDENCE_THRESHOLD = 50; // Textract confidence is 0-100; starting point, tune once real data exists

function computeConfidenceFlags(
  amount: number,
  ocr: SlimOcrResult,
): Record<string, "low_ocr_confidence" | "ocr_mismatch"> {
  const flags: Record<string, "low_ocr_confidence" | "ocr_mismatch"> = {};

  for (const [fieldKey, textractType] of Object.entries(TEXTRACT_FIELD_MAP)) {
    const summaryField = ocr.summaryFields.find((f) => f.type === textractType);
    if (summaryField && summaryField.confidence < LOW_CONFIDENCE_THRESHOLD) {
      flags[fieldKey] = "low_ocr_confidence";
    }
  }

  const textractTotal = ocr.summaryFields.find((f) => f.type === "TOTAL");
  if (textractTotal && Math.abs(Number(textractTotal.value) - amount) > 0.01) {
    flags.amount = "ocr_mismatch"; // overrides low_ocr_confidence if both apply
  }

  return flags;
}
```

Final terminal status, combining 2.6 and 2.7 (extends Decision 8):

```typescript
const requiredFields = schemaVersion.fields.filter((f) => f.required);
const hasBlockingIssue = requiredFields.some(
  (f) => extractedFields[f.key] == null || f.key in confidenceFlags,
);
const status = hasBlockingIssue ? "needs_review" : "complete";
```

Flags on fields that aren't `required` are still persisted in `confidence_flags` and surfaced in the review UI (3.1), but don't block `complete`.

---

## Phase 3 — Schema-Aware UI

**Goal:** The review and export UI render dynamically based on the schema version attached to the job.

### 3.1 Receipt Review UI

The review UI renders dynamically from the schema version. Fields are first split into ungrouped fields and groups, then rendered in `displayOrder`.

**Rendering logic:**

1. Ungrouped fields (`groupId: null`) render inline in the main fieldset
2. Each group renders as a separate `<FieldSet>` with a legend and description — but only if at least one of its member fields currently evaluates visible (Decision 6); the group itself has no condition to check
3. Fields (grouped or not) evaluate their own `showWhen` for visibility
4. `field.description` is shown as a tooltip on the field label (hover)
5. Fields with `extractable: false` render with a "needs your input" indicator and no pre-populated value
6. Fields with `extractable: true` render the AI-extracted value with an edit affordance
7. A receipt in `needs_review` status is surfaced distinctly (e.g., a badge/filter) so unfinished required fields are easy to find; saving values for all required fields transitions the receipt to `complete`
8. Fields present in `confidence_flags` (2.7) render a distinct "please verify" indicator, separate from the "needs your input" indicator — shown whether or not the field is required

```tsx
// Pseudocode — groups rendered as separate fieldsets (mirrors current transport details UX)
const ungrouped = fields.filter((f) => !f.groupId);
const groupedById = groupBy(
  fields.filter((f) => f.groupId),
  (f) => f.groupId,
);

<FieldSet>
  <FieldLegend>Expense Details</FieldLegend>
  {ungrouped
    .filter((f) => evaluateShowWhen(f.showWhen, currentValues))
    .map((field) => (
      <DynamicFieldInput
        key={field.key}
        field={field}
        value={extractedFields[field.key]}
      />
    ))}
</FieldSet>;

{
  schemaVersion.groups.map((group) => {
    const visibleMembers = (groupedById[group.id] ?? []).filter((f) =>
      evaluateShowWhen(f.showWhen, currentValues),
    );
    if (visibleMembers.length === 0) return null; // group has no showWhen of its own — derived from members

    return (
      <FieldSet key={group.id}>
        <FieldLegend>{group.label}</FieldLegend>
        {group.description && (
          <FieldDescription>{group.description}</FieldDescription>
        )}
        {visibleMembers.map((field) => (
          <DynamicFieldInput
            key={field.key}
            field={field}
            value={extractedFields[field.key]}
          />
        ))}
      </FieldSet>
    );
  });
}
```

This preserves the current UX — transport details appear as a distinct section below the main fields, shown only when category is "transport" — but the structure is now entirely data-driven.

### 3.2 Export — Dynamic Columns

The Excel export currently has hardcoded column names. Update to:

1. Load the schema version for the job
2. Generate columns: `Date`, `Amount`, then one column per schema field in `displayOrder`
3. Map `extractedFields[field.key]` to each column

### 3.3 Job Creation

When the user creates a new job, the API:

1. Looks up the user's active `schema_version_id`
2. Records it on the job at creation time
3. No user interaction required — this is automatic

### 3.4 Schema Version History

At `/settings/schema/history`, show version history:

- List all past versions with creation date and number of jobs using that version
- Allow the user to "view" a past version (read-only)
- No rollback — if the user wants to go back, they create a new version matching the old fields

---

## Phase 4 — Multi-Tenant Org Support (Post-MVP)

> Not needed before the first real users. Personal, single-user usage covers the whole MVP surface. This phase is the deferred content of Decision 1.

- [ ] Enable Better Auth organization plugin; generate `organizations`, `members`, `invitations` tables
- [ ] Auto-create a personal org per user (new signups automatically; existing users backfilled by a one-time script that creates one org per user and points their `schemas_table`/`expense_report_jobs_table` rows at it via a new nullable `org_id` column)
- [ ] Scope schema and job queries by `org_id` once populated
- [ ] Email invitations (requires email service integration)
- [ ] Role-based access: members see jobs/receipts, admins see schema settings
- [ ] Org switcher in sidebar (already partially scaffolded by `TeamSwitcher` component)
- [ ] Shared jobs within an org (multiple members contributing receipts to one report)
- [ ] Usage dashboard per org

---

## Phase 5 — Usage Limiting (Post-MVP)

> Design the model now so the table structure is in place. Enforcement is not needed until you have real users.
>
> This is **usage/quota limiting** (a monthly count against a plan cap), not rate limiting in the token-bucket/burst-protection sense — those are different problems that happen to rhyme. A calendar-aligned counter is the correct shape for a monthly cap; it would be the wrong tool for smoothing short bursts. If burst protection against the Textract/OpenAI calls is ever needed, that's a separate, ephemeral (Redis/API-Gateway-throttling) mechanism layered on top — not a replacement for this table, and not scoped here.

### Usage Tracking

Add `user_usage_table` (see `schema-v2.dbml`). Keyed by `user_id` for this version; migrates to `org_id` alongside the rest of Phase 4. `period` is a `date` (first-of-month), not free text — see dbml note.

```typescript
// Increment on every successful extraction
await incrementUserUsage(userId, period: "2026-07-01");
```

**Idempotency note:** the worker's SQS delivery is at-least-once (see phase 1/2's idempotent-resume design), so a redelivered message can reprocess the same receipt. The `ON CONFLICT (user_id, period) DO UPDATE SET receipts_processed = receipts_processed + 1` upsert is atomic, but *calling* it more than once per receipt will still double-count. Don't increment on "phase 2 ran"; increment on "this receipt's extraction transitioned to `is_current` for the first time" (e.g. gated on the insert that sets `is_current = true` actually being the one that created the row, not a retry that no-ops into the existing `uniq_active_receipt` row). Get this right when implementing — a double-counted quota is a real, not hypothetical, failure mode of at-least-once delivery, not an edge case to defer.

### Suggested Free Tier

| Tier       | Price  | Receipts/month | Schema fields | Team members      |
| ---------- | ------ | -------------- | ------------- | ------------------ |
| Free       | $0     | 25             | 10            | 1 (personal only)  |
| Starter    | $12/mo | 200            | 20            | 5 (Phase 4)        |
| Team       | $39/mo | 1000           | 20            | 25 (Phase 4)       |
| Enterprise | Custom | Unlimited      | Unlimited     | Unlimited (Phase 4)|

Enforcement: check `user_usage_table` before enqueueing each receipt. Return a `429 Too Many Requests` with a clear message if over limit.

---

## Implementation Order (Critical Path to First Real User)

```
Phase 1.1  Add schemas_table + schema_versions_table
Phase 1.2  Seed default schema on user creation
Phase 1.3  Add schema_version_id (NOT NULL) to jobs table
Phase 1.4  Schema builder UI
Phase 2.1  Thread schema_version_id through pipeline
Phase 2.2  Dynamic prompt builder
Phase 2.3  Dynamic JSON schema for OpenAI (strict mode: all props in required, optional = nullable union)
Phase 2.4  Define extracted_expenses with JSONB from day one (clean DB)
Phase 2.5  Updated extraction output shape
Phase 2.6  Validation at save time + needs_review transition
Phase 2.7  Confidence signals (Textract passthrough + amount cross-check)
Phase 3.1  Dynamic review UI
Phase 3.2  Dynamic export
─────────────────────────────────────────
         ↑ FIRST REAL USER CAN USE THIS ↑
─────────────────────────────────────────
Phase 3.3  Job creation wiring (small, can land anytime after 1.1)
Phase 3.4  Schema version history
Phase 4    Multi-tenant org support
Phase 5    Usage limiting (free tier enforcement) + billing
```

---

## Open Questions

1. **Schema key immutability** — once a field `key` is used in extracted data, can it ever be renamed? Proposed: no (only add new fields or deprecate old ones by marking hidden).
2. **Compound `showWhen` conditions and comparison operators** — deferred by design (see 1.3's "Known v1 limitations"). This is a condition-engine change, not a field addition, so it's being deliberately left until a real user's schema needs it rather than built speculatively.
3. **`showWhen` cycle detection** — deferred; flagged as a cheap future addition to the Complexity Cap validation (1.5) once picked up.
4. **Multi-org users** — can a user belong to more than one org (e.g., a contractor)? Better Auth supports it natively. This is now purely a Phase 4 concern — no design work needed until orgs exist.
5. **Schema import** — can a user upload their existing Excel template and have the system infer the schema fields? Compelling, validated as worth pursuing eventually, but intentionally excluded from this version pending evidence that the manual schema editor + extraction workflow itself has real demand.
6. **Schema versions** — Limits on how many schema versions a user can make? No limit could cause massive db pressure.
