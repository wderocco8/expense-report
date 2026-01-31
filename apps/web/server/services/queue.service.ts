import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const AWS_REGION = process.env.AWS_REGION;
const SQS_ENDPOINT = process.env.SQS_ENDPOINT;

const sqsClient = new SQSClient({ region: AWS_REGION });

export async function enqueueReceiptProcessing(receiptId: string) {
  const command = new SendMessageCommand({
    QueueUrl: SQS_ENDPOINT,
    MessageBody: JSON.stringify({ receiptId }),
    // Prevents duplicate processing if the UI double-clicks
    MessageDeduplicationId: receiptId,
    MessageGroupId: "receipt-processing",
  });

  return sqsClient.send(command);
}
