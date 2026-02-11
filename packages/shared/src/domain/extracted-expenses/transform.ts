import { ReceiptDTO } from "../../validators/receipt.zod";
import { NewExtractedExpense } from "@repo/db";

export function mapReceiptToDb(
  receipt: ReceiptDTO,
  receiptId: string,
): NewExtractedExpense {
  return {
    receiptId,
    merchant: receipt.merchant ?? null,
    description: receipt.description ?? null,
    date: normalizeDate(receipt.date),
    amount: receipt.amount.toString(),
    category: receipt.category,
    transportDetails:
      receipt.category === "transport" ? receipt.transportDetails : null,
    rawJson: receipt, // store raw OCR output
    modelVersion: "gpt-4o-mini", // or from config
    isCurrent: true,
  };
}

function normalizeDate(dateStr: string): string | null {
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return null; // fallback to null if unfixable

  const d = new Date(parsed);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
