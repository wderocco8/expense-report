import { ReceiptDTO } from "@repo/shared";
import { NewExtractedExpense, OcrResult } from "../schema/app.schema";

interface MapReceiptToDbParams {
  receiptId: string;
  receiptDTO: ReceiptDTO;
  ocrResult?: OcrResult;
}

export function mapReceiptToDb({
  receiptId,
  receiptDTO,
  ocrResult,
}: MapReceiptToDbParams): NewExtractedExpense {
  return {
    receiptId,
    ocrResultId: ocrResult?.id,
    merchant: receiptDTO.merchant,
    description: receiptDTO.description,
    date: normalizeDate(receiptDTO.date),
    amount: receiptDTO.amount.toString(),
    category: receiptDTO.category,
    transportDetails:
      receiptDTO.category === "transport" ? receiptDTO.transportDetails : null,
    rawJson: receiptDTO,
    modelVersion: "gpt-4o-mini",
    isCurrent: true,
  };
}

function normalizeDate(dateStr: string): string | null {
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return null;

  const d = new Date(parsed);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
