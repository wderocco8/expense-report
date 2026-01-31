import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const AWS_REGION = process.env.AWS_REGION;
const SQS_ENDPOINT = process.env.SQS_ENDPOINT;
const QUEUE_URL = process.env.QUEUE_URL;

const client = new SQSClient({
  endpoint: SQS_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: "test", // TODO: replace with real values?
    secretAccessKey: "test",
  },
});

export async function enqueueReceiptProcessing(receiptId: string) {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ receiptId }),
    // Prevents duplicate processing if the UI double-clicks
    // MessageDeduplicationId: receiptId, // TODO: restore if we want a FIFO queue
    // MessageGroupId: "receipt-processing",
  });

  return client.send(command);
}
