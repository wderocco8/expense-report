import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Expenses");

sheet.columns = [
  { header: "Date", key: "date", width: 12 },
  { header: "Merchant", key: "merchant", width: 20 },
  { header: "Category", key: "category", width: 18 },
  { header: "Amount", key: "amount", width: 12 },
  { header: "Notes", key: "notes", width: 30 },
  { header: "Receipt", key: "receipt", width: 30 },
];
