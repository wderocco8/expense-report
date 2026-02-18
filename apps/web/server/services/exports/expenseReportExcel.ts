import { ExpenseReportWithReceiptAndExpense } from "@/server/types/expense-report-jobs";
import { getObjectBuffer } from "@/server/services/storage.service";
import ExcelJS from "exceljs";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function toExcelImageBuffer(buf: Buffer): ExcelJS.Buffer {
  return buf as unknown as ExcelJS.Buffer;
}

const CATEGORY_LIST = [
  "tolls/parking",
  "hotel",
  "transport",
  "fuel",
  "meals",
  "phone",
  "supplies",
  "misc",
] as const;

/**
 * Sorts receipts in DESC order
 * @param receipts
 * @returns
 */
function sortReceiptsByExpenseDate(
  receipts: ExpenseReportWithReceiptAndExpense["receiptFiles"],
) {
  return [...receipts].sort((a, b) => {
    const aDate = a.extractedExpenses[0]?.date;
    const bDate = b.extractedExpenses[0]?.date;

    if (!aDate) return 1;
    if (!bDate) return -1;

    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

/* -------------------------------------------------------------------------- */
/*                           Expenses Sheet Builder                           */
/* -------------------------------------------------------------------------- */

async function buildExpensesSheet(
  workbook: ExcelJS.Workbook,
  job: ExpenseReportWithReceiptAndExpense,
) {
  const sheet = workbook.addWorksheet("Expenses");

  const sortedReceipts = sortReceiptsByExpenseDate(job.receiptFiles);

  const tableRows = sortedReceipts
    .map((receipt) => {
      const expense = receipt.extractedExpenses[0];
      if (!expense) return null;

      return [
        expense.date ? new Date(expense.date) : null,
        expense.merchant ?? null,
        expense.description ?? null,
        expense.category ?? null,
        expense.amount != null ? Number(expense.amount) : null,
        expense.transportDetails?.mode ?? null,
        expense.transportDetails?.mileage ?? null,
        receipt.originalFilename ?? null,
        null,
      ];
    })
    .filter(Boolean);

  /* ----------------------------- Create Table ----------------------------- */

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
      { name: "Receipt" },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: tableRows as any[],
  });

  formatExpensesSheet(sheet);
  applyExpensesDataValidation(sheet);
  await addReceiptImages(workbook, sheet, sortedReceipts);
}

/* -------------------------------------------------------------------------- */
/*                           Expenses Sheet Helpers                           */
/* -------------------------------------------------------------------------- */

function formatExpensesSheet(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    column.alignment = { wrapText: true, vertical: "top" };
  });

  sheet.getColumn("A").width = 14;
  sheet.getColumn("B").width = 20;
  sheet.getColumn("C").width = 30;
  sheet.getColumn("D").width = 18;
  sheet.getColumn("E").width = 14;
  sheet.getColumn("F").width = 14;
  sheet.getColumn("G").width = 10;
  sheet.getColumn("H").width = 24;
  sheet.getColumn("I").width = 30;

  sheet.getColumn("A").numFmt = "mm/dd/yyyy";
  sheet.getColumn("E").numFmt = "$#,##0.00";

  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function applyExpensesDataValidation(sheet: ExcelJS.Worksheet) {
  const lastRow = sheet.rowCount;

  for (let i = 2; i <= lastRow; i++) {
    sheet.getCell(`D${i}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${CATEGORY_LIST.join(",")}"`],
    };

    sheet.getCell(`F${i}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"train,car,plane"'],
    };
  }
}

async function addReceiptImages(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  receipts: ExpenseReportWithReceiptAndExpense["receiptFiles"],
) {
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    const expense = receipt.extractedExpenses[0];
    if (!expense) continue;

    const buffer = await getObjectBuffer(receipt.s3Key);

    const imageId = workbook.addImage({
      buffer: toExcelImageBuffer(buffer),
      extension: "jpeg",
    });

    const rowNumber = i + 2;

    sheet.addImage(imageId, {
      tl: { col: 8, row: rowNumber - 1 },
      ext: { width: 150, height: 200 },
    });

    sheet.getRow(rowNumber).height = 150;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Summary Sheet Builder                           */
/* -------------------------------------------------------------------------- */

function buildSummarySheet(workbook: ExcelJS.Workbook) {
  const summarySheet = workbook.addWorksheet("Summary");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryRows: any[] = CATEGORY_LIST.map((category) => [
    category,
    {
      formula: `SUMIF(ExpensesTable[Category], "${category}", ExpensesTable[Amount])`,
    },
  ]);

  summaryRows.push(["TOTAL", { formula: `SUM(ExpensesTable[Amount])` }]);

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

  summarySheet.getColumn("A").width = 22;
  summarySheet.getColumn("B").width = 18;
  summarySheet.getColumn("B").numFmt = "$#,##0.00";

  summarySheet.getRow(summarySheet.rowCount).font = { bold: true };
  summarySheet.views = [{ state: "frozen", ySplit: 1 }];
}

/* -------------------------------------------------------------------------- */
/*                              Public Entrypoint                             */
/* -------------------------------------------------------------------------- */

export async function buildExpenseReportWorkbook(
  job: ExpenseReportWithReceiptAndExpense,
) {
  const workbook = new ExcelJS.Workbook();

  await buildExpensesSheet(workbook, job);
  buildSummarySheet(workbook);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
