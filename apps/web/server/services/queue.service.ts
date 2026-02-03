import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const AWS_REGION = process.env.AWS_REGION;
const SQS_ENDPOINT = process.env.SQS_ENDPOINT;
const QUEUE_URL = process.env.QUEUE_URL;
const SQS_ACCESS_KEY_ID = process.env.SQS_ACCESS_KEY_ID;
const SQS_SECRET_ACCESS_KEY = process.env.SQS_SECRET_ACCESS_KEY;

const client = new SQSClient({
  region: AWS_REGION,
  useQueueUrlAsEndpoint: true,
  ...(SQS_ENDPOINT ? { endpoint: SQS_ENDPOINT } : {}),
  credentials: {
    accessKeyId: SQS_ACCESS_KEY_ID!,
    secretAccessKey: SQS_SECRET_ACCESS_KEY!,
  },
});

export async function enqueueReceiptProcessing(receiptId: string) {
  if (!QUEUE_URL) throw new Error("QUEUE_URL is not defined");

  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ receiptId }),
    // Prevents duplicate processing if the UI double-clicks
    // MessageDeduplicationId: receiptId, // TODO: restore if we want a FIFO queue
  });

  return client.send(command);
}
