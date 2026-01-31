const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const client = new SQSClient({
  endpoint: "http://localhost:4566",
  region: "us-east-2",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const QUEUE_URL = "http://localhost:4566/000000000000/receipts";

async function sendTestMessage() {
  const receiptId = process.argv[2] || "test-receipt-123";

  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ receiptId }),
  });

  await client.send(command);
  console.log(`✅ Sent message for receipt: ${receiptId}`);
}

sendTestMessage().catch(console.error);
