import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

export class WorkerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create SQS Queue
    const receiptQueue = new sqs.Queue(this, 'ReceiptQueue', {
      queueName: 'receipts',
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    // Create Lambda Function
    const receiptProcessor = new lambda.Function(this, 'ReceiptProcessor', {
      functionName: 'receipt-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        // Add any env vars your Lambda needs
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    });

    // Connect SQS to Lambda
    receiptProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(receiptQueue, {
        batchSize: 10,
      })
    );

    // Output the queue URL
    new cdk.CfnOutput(this, 'QueueUrl', {
      value: receiptQueue.queueUrl,
      exportName: 'ReceiptQueueUrl',
    });
  }
}