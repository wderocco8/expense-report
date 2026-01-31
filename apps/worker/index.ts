import { SQSEvent } from "aws-lambda";
// import { processReceipt } from "@repo/services";

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { receiptId } = JSON.parse(record.body);
    console.log("[SQS handler] Processing receipt", receiptId);
    // await processReceipt(receiptId);
  }
};
