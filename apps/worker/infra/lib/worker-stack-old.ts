import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export class WorkerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket
    const receiptBucket = new s3.Bucket(this, "ReceiptBucket", {
      bucketName: "expense-receipts",
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Dead Letter Queue
    const dlq = new sqs.Queue(this, "ReceiptProcessingDLQ", {
      queueName: "receipt-processing-dlq",
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main SQS Queue
    const queue = new sqs.Queue(this, "ReceiptProcessingQueue", {
      queueName: "receipt-processing-queue",
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Lambda Function
    const receiptProcessor = new lambda.Function(this, "ReceiptProcessor", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../dist"),
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: receiptBucket.bucketName,
        // Add your DB connection, etc.
      },
    });

    // Grant permissions
    receiptBucket.grantReadWrite(receiptProcessor);

    // Add SQS trigger
    receiptProcessor.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
      }),
    );

    // Outputs
    new cdk.CfnOutput(this, "QueueUrl", {
      value: queue.queueUrl,
    });
    new cdk.CfnOutput(this, "BucketName", {
      value: receiptBucket.bucketName,
    });
  }
}
