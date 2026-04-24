import { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { processReceipt } from "@repo/services";

// Delay between processing receipts to smooth out burst traffic
// This helps prevent hitting OpenAI rate limits when multiple Lambdas start simultaneously
const RECEIPT_PROCESSING_DELAY_MS = 100;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log(`[SQS handler] Processing ${event.Records.length} messages`);

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  // Process each message individually
  for (let i = 0; i < event.Records.length; i++) {
    const record = event.Records[i];

    try {
      const { receiptId } = JSON.parse(record.body);
      console.log(`[SQS handler] Processing receipt ${receiptId}`);

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

    // Add small delay between receipts (except for the last one)
    // This helps smooth out burst traffic to OpenAI API
    if (i < event.Records.length - 1) {
      await sleep(RECEIPT_PROCESSING_DELAY_MS);
    }
  }

  // Return batch failures so SQS knows which messages to retry
  return {
    batchItemFailures,
  };
};
