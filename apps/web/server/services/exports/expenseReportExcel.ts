import { ExpenseReportWithReceiptAndExpense } from "@/server/types/expense-report-jobs";
import { getObjectBuffer } from "@/server/services/storage.service";
import ExcelJS from "exceljs";

function toExcelImageBuffer(buf: Buffer): ExcelJS.Buffer {
  return buf as unknown as ExcelJS.Buffer;
}

export async function buildExpenseReportWorkbook(
  job: ExpenseReportWithReceiptAndExpense,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Expenses");

  // column definitions
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Merchant", key: "merchant", width: 20 },
    { header: "Description", key: "description", width: 30 },
    { header: "Category", key: "category", width: 18 },
    { header: "Amount", key: "amount", width: 12 },

    { header: "Transport Mode", key: "transportMode", width: 14 },
    { header: "Mileage", key: "mileage", width: 10 },

    { header: "Original Filename", key: "filename", width: 24 },
    { header: "Receipt Status", key: "status", width: 12 },

    { header: "Receipt", key: "receipt", width: 30 },
  ];

  // cell formatting
  for (const column of sheet.columns) {
    column.alignment = { wrapText: true, vertical: "top" };
  }

  // views
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getColumn("amount").numFmt = "$#,##0.00";
  sheet.autoFilter = {
    from: "A1",
    to: "L1",
  };

  // insert data
  for (const receipt of job.receiptFiles) {
    const buffer = await getObjectBuffer(receipt.s3Key);
    const imageId = workbook.addImage({
      buffer: toExcelImageBuffer(buffer),
      extension: "jpeg", // TODO: should this be determined from s3?
    });

    const expense = receipt.extractedExpenses[0];
    if (!expense) {
      console.error("Failed to extract expense for receipt");
      continue;
    }

    const row = sheet.addRow({
      date: expense.date,
      merchant: expense.merchant,
      description: expense.description,
      category: expense.category,
      amount: expense.amount != null ? Number(expense.amount) : null,

      transportMode: expense.transportDetails?.mode ?? null,
      mileage: expense.transportDetails?.mileage ?? null,

      filename: receipt.originalFilename,
      status: receipt.status,
    });

    const rowNumber = row.number;

    sheet.addImage(imageId, {
      tl: { col: 11, row: rowNumber - 1 }, // adjust for new columns
      ext: { width: 150, height: 200 },
    });

    sheet.getRow(rowNumber).height = 150;
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
