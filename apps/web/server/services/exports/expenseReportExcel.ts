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

  // ----------------------------
  // 1: Prepare Row Data
  // ----------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableRows: any[] = [];

  for (const receipt of job.receiptFiles) {
    const expense = receipt.extractedExpenses[0];
    if (!expense) continue;

    tableRows.push([
      expense.date ? new Date(expense.date) : null,
      expense.merchant ?? null,
      expense.description ?? null,
      expense.category ?? null,
      expense.amount != null ? Number(expense.amount) : null,
      expense.transportDetails?.mode ?? null,
      expense.transportDetails?.mileage ?? null,
      receipt.originalFilename ?? null,
      receipt.status ?? null,
      null, // placeholder for receipt image column
    ]);
  }

  // ----------------------------
  // 2: Create Excel Table
  // ----------------------------

  sheet.addTable({
    name: "ExpensesTable",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: [
      { name: "Date" },
      { name: "Merchant" },
      { name: "Description" },
      { name: "Category" },
      { name: "Amount" },
      { name: "Transport Mode" },
      { name: "Mileage" },
      { name: "Original Filename" },
      { name: "Receipt Status" },
      { name: "Receipt" },
    ],
    rows: tableRows,
  });

  const lastRow = sheet.rowCount;

  // ----------------------------
  // 3: Column Formatting
  // ----------------------------

  sheet.columns.forEach((column) => {
    column.alignment = { wrapText: true, vertical: "top" };
  });

  sheet.getColumn("A").width = 14; // Date
  sheet.getColumn("B").width = 20; // Merchant
  sheet.getColumn("C").width = 30; // Description
  sheet.getColumn("D").width = 18; // Category
  sheet.getColumn("E").width = 14; // Amount
  sheet.getColumn("F").width = 14; // Transport
  sheet.getColumn("G").width = 10; // Mileage
  sheet.getColumn("H").width = 24; // Filename
  sheet.getColumn("I").width = 14; // Status
  sheet.getColumn("J").width = 30; // Receipt

  sheet.getColumn("A").numFmt = "mm/dd/yyyy";
  sheet.getColumn("E").numFmt = "$#,##0.00"; // Amount column

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // ----------------------------
  // 4: Data Validation
  // ----------------------------

  for (let i = 2; i <= lastRow; i++) {
    // Category dropdown (Column D)
    sheet.getCell(`D${i}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [
        '"tolls/parking,hotel,transport,fuel,meals,phone,supplies,misc"',
      ],
    };

    // Transport Mode dropdown (Column F)
    sheet.getCell(`F${i}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"train,car,plane"'],
    };
  }

  // ----------------------------
  // 5: Add Images
  // ----------------------------

  for (let i = 0; i < job.receiptFiles.length; i++) {
    const receipt = job.receiptFiles[i];
    const expense = receipt.extractedExpenses[0];
    if (!expense) continue;

    const buffer = await getObjectBuffer(receipt.s3Key);
    const imageId = workbook.addImage({
      buffer: toExcelImageBuffer(buffer),
      extension: "jpeg",
    });

    const rowNumber = i + 2;

    sheet.addImage(imageId, {
      tl: { col: 9, row: rowNumber - 1 },
      ext: { width: 150, height: 200 },
    });

    sheet.getRow(rowNumber).height = 150;
  }

  // ----------------------------
  // 6: Summary Sheet (Formatted Table)
  // ----------------------------

  const summarySheet = workbook.addWorksheet("Summary");

  // Categories
  const categories = [
    "tolls/parking",
    "hotel",
    "transport",
    "fuel",
    "meals",
    "phone",
    "supplies",
    "misc",
  ];

  // Build rows first
  const summaryRows = categories.map((category) => [
    category,
    {
      formula: `SUMIF(ExpensesTable[Category], "${category}", ExpensesTable[Amount])`,
    },
  ]);

  // Add TOTAL row
  summaryRows.push(["TOTAL", { formula: `SUM(ExpensesTable[Amount])` }]);

  // Create Table
  summarySheet.addTable({
    name: "SummaryTable",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: [{ name: "Category" }, { name: "Total" }],
    rows: summaryRows,
  });

  // Column Formatting
  summarySheet.getColumn("A").width = 22;
  summarySheet.getColumn("B").width = 18;
  summarySheet.getColumn("B").numFmt = "$#,##0.00";

  // Bold TOTAL row
  const totalRowNumber = summarySheet.rowCount;
  summarySheet.getRow(totalRowNumber).font = { bold: true };

  // Freeze header
  summarySheet.views = [{ state: "frozen", ySplit: 2 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
