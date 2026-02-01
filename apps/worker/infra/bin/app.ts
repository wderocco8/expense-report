#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WorkerStack } from "../lib/worker-stack";

const app = new cdk.App();

new WorkerStack(app, "WorkerStack-local", {
  env: {
    account: "000000000000",
    region: "us-east-2",
  },
  visibilityTimeoutSeconds: 10, // 10 seconds
});

new WorkerStack(app, "WorkerStack-staging", {
  env: {
    account: process.env.AWS_ACCOUNT_ID,
    region: "us-east-2",
  },
  visibilityTimeoutSeconds: 300, // 5 minutes
});

new WorkerStack(app, "WorkerStack-prod", {
  env: {
    account: process.env.AWS_ACCOUNT_ID,
    region: "us-east-2",
  },
  visibilityTimeoutSeconds: 300, // 5 minutes
});
