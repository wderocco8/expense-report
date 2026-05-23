import { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { processReceipt } from "@repo/services";

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log(`[SQS handler] Processing ${event.Records.length} messages`);

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  // Process each message individually
  for (let i = 0; i < event.Records.length; i++) {
    const record = event.Records[i];

    try {
      const { receiptId } = JSON.parse(record.body);
      console.log(`[SQS handler] Processing (two-phase) receipt ${receiptId}`);

      await processReceipt(receiptId);

      console.log(`[SQS handler] Successfully processed receipt ${receiptId}`);
    } catch (error) {
      console.error(
        `[SQS handler] Failed to process message ${record.messageId}:`,
        error,
      );

      // Report this specific message as failed
      // SQS will retry it while successfully processed messages are deleted
      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  // Return batch failures so SQS knows which messages to retry
  return {
    batchItemFailures,
  };
};
