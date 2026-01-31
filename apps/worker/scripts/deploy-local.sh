#!/bin/bash
set -e

echo "Building Lambda..."
cd "$(dirname "$0")/.."
npm run build

echo "Creating function.zip..."
cd dist
zip -r ../function.zip .
cd ..

# Load variables from .env file
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

echo "Creating SQS queue..."
awslocal sqs create-queue --queue-name receipts 2>/dev/null || echo "Queue already exists"

echo "Deleting old event source mapping (if exists)..."
MAPPING_UUID=$(awslocal lambda list-event-source-mappings \
  --function-name receipt-processor \
  --query 'EventSourceMappings[0].UUID' \
  --output text 2>/dev/null) || true

if [ "$MAPPING_UUID" != "None" ] && [ -n "$MAPPING_UUID" ]; then
  awslocal lambda delete-event-source-mapping --uuid "$MAPPING_UUID"
  echo "Deleted existing mapping"
fi

echo "Deleting old Lambda (if exists)..."
awslocal lambda delete-function --function-name receipt-processor 2>/dev/null || true

sleep 2

echo "Creating Lambda function..."
awslocal lambda create-function \
  --function-name receipt-processor \
  --runtime nodejs20.x \
  --zip-file fileb://function.zip \
  --handler index.handler \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --timeout 30 \
  --environment "Variables={
    OPENAI_API_KEY=$OPENAI_API_KEY,
    DATABASE_URL=$DATABASE_URL,
    S3_ENDPOINT=$S3_ENDPOINT,
    S3_REGION=$S3_REGION,
    S3_ACCESS_KEY=$S3_ACCESS_KEY,
    S3_SECRET_KEY=$S3_SECRET_KEY,
    S3_BUCKET=$S3_BUCKET,
    SQS_ENDPOINT=$SQS_ENDPOINT,
    QUEUE_URL=$QUEUE_URL,
  }"

echo "Waiting for Lambda to be active..."
awslocal lambda wait function-active-v2 --function-name receipt-processor

echo "Connecting SQS to Lambda..."
awslocal lambda create-event-source-mapping \
  --function-name receipt-processor \
  --event-source-arn arn:aws:sqs:us-east-2:000000000000:receipts \
  --batch-size 10

echo "✅ Deployment complete!"
echo "Queue URL: http://localhost:4566/000000000000/receipts"