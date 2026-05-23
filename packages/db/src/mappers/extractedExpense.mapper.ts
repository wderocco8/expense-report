import { ReceiptDTO } from "@repo/shared";
import { NewExtractedExpense } from "../schema/app.schema";

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
    rawJson: receipt,
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
