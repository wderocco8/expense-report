import { SlimOcrResult } from "@repo/db";
import { OpenAIExtractionService } from "./openai-extraction.service";

// ---------------------------------------------------------------------------
// Test fixture — real AnalyzeExpense output from Uber receipt
// (34a1d7f8-ebdf-4bd9-812e-bf7ff56affe0.png), geometry stripped
// ---------------------------------------------------------------------------
const uberReceiptOcr: SlimOcrResult = {
  summaryFields: [
    {
      type: "ADDRESS",
      label: null,
      value: "CoV Edina\n3155 Galleria",
      confidence: 99.52352905273438,
    },
    {
      type: "STREET",
      label: null,
      value: "3155 Galleria",
      confidence: 99.99894714355469,
    },
    {
      type: "NAME",
      label: null,
      value: "CoV Edina",
      confidence: 99.99363708496094,
    },
    {
      type: "ADDRESS_BLOCK",
      label: null,
      value: "3155 Galleria",
      confidence: 99.99894714355469,
    },
    {
      type: "INVOICE_RECEIPT_DATE",
      label: null,
      value: "01/21/2026",
      confidence: 99.9989013671875,
    },
    {
      type: "INVOICE_RECEIPT_ID",
      label: null,
      value: "60109",
      confidence: 99.93864440917969,
    },
    {
      type: "SUBTOTAL",
      label: "Subtotal",
      value: "38.95",
      confidence: 99.99872589111328,
    },
    {
      type: "SUBTOTAL",
      label: "Total",
      value: "42.47",
      confidence: 99.99467468261719,
    },
    {
      type: "SUBTOTAL",
      label: "Balance Due",
      value: "42.47",
      confidence: 94.32969665527344,
    },
    {
      type: "TAX",
      label: "Tax",
      value: "3.52",
      confidence: 99.99652862548828,
    },
    {
      type: "VENDOR_ADDRESS",
      label: null,
      value: "CoV Edina\n3155 Galleria",
      confidence: 99.52352905273438,
    },
    {
      type: "VENDOR_NAME",
      label: null,
      value: "CoV Edina",
      confidence: 99.99363708496094,
    },
    {
      type: "VENDOR_PHONE",
      label: null,
      value: "952-999-4011",
      confidence: 99.9938735961914,
    },
    {
      type: "OTHER",
      label: "Server:",
      value: "JANET",
      confidence: 99.99969482421875,
    },
    {
      type: "OTHER",
      label: "Guests:",
      value: "0",
      confidence: 99.99168395996094,
    },
    {
      type: "OTHER",
      label: "Reprint #:",
      value: "1",
      confidence: 99.98037719726562,
    },
  ],
  lineItems: [
    {
      description: "D-ROTISSERIE CHICKEN",
      quantity: null,
      unitPrice: null,
      total: "36.00",
      row: "D-ROTISSERIE CHICKEN 36.00",
    },
    {
      description: "FRESCA",
      quantity: null,
      unitPrice: null,
      total: "2.95",
      row: "FRESCA 2.95",
    },
  ],
  rawText:
    "CoV Edina\n" +
    "3155 Galleria\n" +
    "952-999-4011\n" +
    "Server: JANET\n" +
    "01/21/2026\n" +
    "201 Lori/1\n" +
    "7:16 PM\n" +
    "Guests: 0\n" +
    "60109\n" +
    "Reprint #: 1\n" +
    "D-ROTISSERIE CHICKEN\n" +
    "36.00\n" +
    "FRESCA\n" +
    "2.95\n" +
    "Subtotal\n" +
    "38.95\n" +
    "Tax\n" +
    "3.52\n" +
    "Total\n" +
    "42.47\n" +
    "Balance Due\n" +
    "42.47\n" +
    "10- -\n" +
    "Thank You !!!\n" +
    "All parties of 7 or more\n" +
    "are automaticlly assigned\n" +
    "42.47\n" +
    "an 18% gratuity.",
};

// ---------------------------------------------------------------------------
// NOTE: extractFromText currently takes a raw string — it should be updated
// to accept SlimOcrResult directly. For now we serialize the slim result
// into the same prompt format that buildPrompt() will produce so the test
// reflects the actual input OpenAI will receive.
// ---------------------------------------------------------------------------
function buildPrompt(ocr: SlimOcrResult): string {
  const fields = ocr.summaryFields
    .map((f) => `${f.type}${f.label ? ` (${f.label})` : ""}: ${f.value}`)
    .join("\n");

  const items = ocr.lineItems
    .map((li, i) =>
      [
        `Item ${i + 1}:`,
        li.description ? `  description: ${li.description}` : null,
        li.quantity ? `  quantity: ${li.quantity}` : null,
        li.unitPrice ? `  unit_price: ${li.unitPrice}` : null,
        li.total ? `  total: ${li.total}` : null,
        li.row ? `  row: ${li.row}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return [
    "## Structured fields (extracted by Textract)",
    fields,
    items ? `\n## Line items\n${items}` : "",
    "\n## Full receipt text (completeness fallback)",
    ocr.rawText,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
const service = new OpenAIExtractionService();

async function main() {
  console.log("Testing OpenAIExtractionService...\n");

  // const prompt = buildPrompt(uberReceiptOcr);

  // console.log("--- Prompt sent to OpenAI ---");
  // console.log(prompt);
  console.log("\n--- Calling OpenAI ---\n");

  // TODO: update extractFromText to accept SlimOcrResult instead of string
  // so this call becomes: service.extractFromOcr(uberReceiptOcr)
  const result = await service.extractFromText(uberReceiptOcr);

  console.log("--- Result ---");
  console.log("Success:", result.success);
  console.log("Should Retry:", result.shouldRetry);

  if (result.success && result.data) {
    console.log("\nExtracted expense:");
    console.dir(result.data, { depth: null });

    // Sanity checks
    const checks = [
      {
        label: "merchant is Uber",
        pass: result.data.merchant?.toLowerCase().includes("uber"),
      },
      { label: "amount is 56.10", pass: Number(result.data.amount) === 56.1 },
      { label: "date is 2026-01-21", pass: result.data.date === "2026-01-21" },
      {
        label: "category is transport",
        pass: result.data.category === "transport",
      },
      {
        label: "transportDetails present",
        pass: result.data.transportDetails !== null,
      },
    ];

    console.log("\n--- Sanity checks ---");
    let passed = 0;
    for (const check of checks) {
      const icon = check.pass ? "✓" : "✗";
      console.log(`${icon} ${check.label}`);
      if (check.pass) passed++;
    }
    console.log(`\n${passed}/${checks.length} checks passed`);
  } else {
    console.error("Error:", result.error);
  }
}

main().catch(console.error);
