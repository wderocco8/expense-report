#!/bin/bash

echo "Sending valid message..."
awslocal sqs send-message \
  --queue-url http://localhost:4566/000000000000/receipts \
  --message-body '{"receiptId":"0300af2d-4ad5-41dc-932e-52f08212fbae"}'

echo "Sending invalid message (will fail and retry)..."
awslocal sqs send-message \
  --queue-url http://localhost:4566/000000000000/receipts \
  --message-body '{"receiptId":"0300af2d-4ad5-41dc-932e-52f08212fbaa"}'

echo "Wait ~30 seconds, then check DLQ for failed message..."
echo "awslocal sqs receive-message --queue-url http://localhost:4566/000000000000/receipts-dlq"