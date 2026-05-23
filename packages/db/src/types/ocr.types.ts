export interface SlimSummaryField {
  type: string;
  label: string | null;
  value: string;
  confidence: number;
}

export interface SlimLineItem {
  description: string | null;
  quantity: string | null;
  unitPrice: string | null;
  total: string | null;
  row: string | null;
}

export interface SlimOcrResult {
  summaryFields: SlimSummaryField[];
  lineItems: SlimLineItem[];
  rawText: string;
}
