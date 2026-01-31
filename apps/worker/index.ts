import { SQSEvent } from "aws-lambda";
import { processReceipt } from "@repo/services";

if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: __dirname + "/../.env.local" });
}

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { receiptId } = JSON.parse(record.body);
    console.log("[SQS handler] Processing receipt", receiptId);
    await processReceipt(receiptId);
  }
};
