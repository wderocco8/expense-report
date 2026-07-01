#!/bin/bash
set -e

export CDK_DISABLE_LEGACY_EXPORT_WARNING=1

cd "$(dirname "$0")/.."

echo "Building Lambda..."
npm run build

echo "Bundling sharp for Linux Lambda..."
HOST_ARCH=$(uname -m)
LINUX_ARCH="x64"; [ "$HOST_ARCH" = "arm64" ] && LINUX_ARCH="arm64"
cd dist
echo '{}' > package.json
npm install --cpu=$LINUX_ARCH --os=linux --libc=glibc sharp@0.34.5 2>&1 | grep -v "^npm warn"
rm -f package.json package-lock.json
cd ..

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