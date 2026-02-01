#!/bin/bash
set -e

export CDK_DISABLE_LEGACY_EXPORT_WARNING=1

cd "$(dirname "$0")/.."

# Load env vars from .env.local
if [ -f .env.local ]; then
  set -a  # automatically export all variables
  source .env.local
  set +a
fi

echo "Building Lambda..."
npm run build

echo "Checking if CDK is bootstrapped..."
# Try to bootstrap (will skip if already done)
cdklocal bootstrap aws://000000000000/us-east-2 2>/dev/null || echo "Already bootstrapped or bootstrap skipped"

echo "Deploying to LocalStack..."
cdklocal deploy WorkerStack-local --require-approval never --outputs-file cdk-outputs.json

echo "✅ Deployment complete!"

# Show outputs
if [ -f cdk-outputs.json ]; then
  echo ""
  echo "Stack Outputs:"
  cat cdk-outputs.json | jq
fi