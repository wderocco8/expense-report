import { TextractService } from "./textract.service";
// import * as dotenv from "dotenv";

// // Load your env vars — adjust path to wherever your .env lives
// dotenv.config({ path: "../../../.env" });

const service = new TextractService();

// Replace with a real key that exists in your S3 bucket
// const testS3Key = "receipts/9e78afac-8968-4591-bfbd-2c67681e9414/34a1d7f8-ebdf-4bd9-812e-bf7ff56affe0.png";
// const testS3Key = "receipts/9e78afac-8968-4591-bfbd-2c67681e9414/93072c65-7e64-4183-9fe4-deeedb920870.jpg";
const testS3Key = "receipts/9e78afac-8968-4591-bfbd-2c67681e9414/e7de8b7b-2c96-4fd7-956f-384da65b3b88.jpg";

async function main() {
  console.log("Testing TextractService.extractText...");
  console.log("S3 Key:", testS3Key);

  const result = await service.extractText(testS3Key);

  console.log("\n--- Result ---");
  console.log("Success:", result.success);
  console.log("Average Confidence:", result.avgConfidence);
  console.log("Should Retry:", result.shouldRetry);

  if (result.success) {
    console.log("\nExtracted Text:\n", result.data);
  } else {
    console.error("Error:", result.error);
  }
}

main().catch(console.error);
