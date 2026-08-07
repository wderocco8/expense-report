export type SchemaFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "enum"
  | "multi_select";

export interface ShowWhen {
  // key of another field in this schema version, OR the reserved system
  // keys "amount" / "date" (typed columns, not present in `fields`)
  field: string;
  op: "eq" | "neq" | "in";
  value: string | string[]; // string for eq/neq, string[] for in
}

export interface SchemaFieldDefinition {
  key: string; // unique snake_case, immutable after creation. Reserved: "amount", "date"
  label: string;
  type: SchemaFieldType;
  required: boolean;
  extractable: boolean;
  options: string[] | null; // required for enum / multi_select, max 30
  description: string | null; // user-facing tooltip only, never sent to the AI prompt
  groupId: string | null;
  showWhen: ShowWhen | null;
  displayOrder: number;
}

export interface FieldGroup {
  id: string;
  label: string;
  description: string | null;
}

export type ExtractedFields = Record<
  string,
  string | number | boolean | string[] | null
>;

export type ConfidenceFlags = Record<
  string,
  "low_ocr_confidence" | "ocr_mismatch"
>;
