import { ExpenseReportWithReceiptAndExpense } from "@/server/types/expense-report-jobs";
import { getObjectBuffer } from "@/server/services/storage.service";
import ExcelJS from "exceljs";

function toExcelImageBuffer(buf: Buffer): ExcelJS.Buffer {
  return buf as unknown as ExcelJS.Buffer;
}

export async function buildExpenseReportWorkbook(
  job: ExpenseReportWithReceiptAndExpense
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Expenses");

  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Merchant", key: "merchant", width: 20 },
    { header: "Category", key: "category", width: 18 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Receipt", key: "receipt", width: 30 },
  ];

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getColumn("amount").numFmt = "$#,##0.00";

  for (const receipt of job.receiptFiles) {
    const buffer = await getObjectBuffer(receipt.s3Key);
    const imageId = workbook.addImage({
      buffer: toExcelImageBuffer(buffer),
      extension: "jpeg", // TODO: should this be determined from s3?
    });

    const row = sheet.addRow({
      date: receipt.extractedExpenses[0].date,
      merchant: receipt.extractedExpenses[0].merchant,
      category: receipt.extractedExpenses[0].category,
      amount: receipt.extractedExpenses[0].amount,
    });

    const rowNumber = row.number;

    sheet.addImage(imageId, {
      tl: { col: 5, row: rowNumber - 1 },
      ext: { width: 150, height: 200 },
    });

    sheet.getRow(rowNumber).height = 150;
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
