import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import * as path from "path";

interface WorkerStackProps extends cdk.StackProps {
  visibilityTimeoutSeconds?: number;
}

export class WorkerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: WorkerStackProps) {
    super(scope, id, props);

    const visibilityTimeout = props?.visibilityTimeoutSeconds || 300;
    const isLocal = this.stackName.includes("local");

    // Create Dead Letter Queue (DLQ) for failed messages
    const receiptDLQ = new sqs.Queue(this, "ReceiptDLQ", {
      queueName: "receipts-dlq",
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create SQS Queue (with DLQ fallback)
    const receiptQueue = new sqs.Queue(this, "ReceiptQueue", {
      queueName: "receipts",
      visibilityTimeout: cdk.Duration.seconds(visibilityTimeout),

      deadLetterQueue: {
        queue: receiptDLQ,
        maxReceiveCount: 3,
      },

      retentionPeriod: cdk.Duration.days(4),
    });

    // Create Lambda Function
    const receiptProcessor = new lambda.Function(this, "ReceiptProcessor", {
      functionName: "receipt-processor",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../dist")),
      timeout: cdk.Duration.seconds(120), // 2 minutes
      memorySize: 1024, // Adjust for faster processing
      environment: {
        NODE_ENV: isLocal ? "development" : "production",
        // For local, these come from your .env.local via process.env
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
        DATABASE_URL: process.env.DATABASE_URL || "",
        S3_REGION: process.env.S3_REGION || "",
        S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || "",
        S3_SECRET_KEY: process.env.S3_SECRET_KEY || "",
        S3_BUCKET: process.env.S3_BUCKET || "",

        ...(isLocal && {
          S3_ENDPOINT: process.env.S3_ENDPOINT || "",
        }),
      },
    });

    // Connect SQS to Lambda
    receiptProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(receiptQueue, {
        batchSize: 10,
        reportBatchItemFailures: true, // IMPORTANT: Enables partial batch failures
        maxConcurrency: 5, // Max 5 concurrent Lambda invocations from this queue
      }),
    );

    // Outputs
    new cdk.CfnOutput(this, "QueueUrl", {
      value: receiptQueue.queueUrl,
      exportName: `ReceiptQueueUrl-${this.stackName}`,
    });

    new cdk.CfnOutput(this, "DLQUrl", {
      value: receiptDLQ.queueUrl,
      exportName: `ReceiptDLQUrl-${this.stackName}`,
    });
  }
}
