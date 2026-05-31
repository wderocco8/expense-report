# Expense Report

An AI-powered expense report automation system. Upload receipt images and let the AI extract structured data (merchant, amount, category, date) for easy export to Excel.

## Architecture

This is a monorepo using pnpm workspaces with the following services:

- **Web** (`apps/web`): Next.js 16 frontend + API routes (authentication, dashboard, uploads)
- **Worker** (`apps/worker`): Lambda-style background processor for AI receipt extraction
- **Database** (`packages/db`): Drizzle ORM with PostgreSQL
- **Services** (`packages/services`): Shared business logic
- **Shared** (`packages/shared`): Shared types and utilities

## Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Version 10.28.1 or higher (specified in `packageManager`)
- **Docker**: For local infrastructure (PostgreSQL, Neon Proxy, LocalStack)
- **AWS CLI + LocalStack**: For local Lambda deployment

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create a secrets file at `~/.config/secrets/expense-report.env` with the following variables:

```env
# Database (automatically configured via Docker)
DATABASE_URL="postgres://postgres:postgres@db.localtest.me:4444/main"

S3_ENDPOINT="https://s3.us-east-2.amazonaws.com"
S3_REGION="us-east-2"
S3_BUCKET="your-dev-bucket-name"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"

# LocalStack (AWS emulation)
AWS_ACCESS_KEY_ID="test"
AWS_SECRET_ACCESS_KEY="test"
AWS_DEFAULT_REGION="us-east-2"

# OpenAI (for receipt extraction)
OPENAI_API_KEY="sk-..."

# Better Auth (generate a secure secret)
BETTER_AUTH_SECRET="your-secret-here"
BETTER_AUTH_URL="http://localhost:3000"
```

If using [direnv](https://direnv.net/), the `.envrc` file will automatically load this file.

### 3. Start Infrastructure Services

```bash
docker-compose up -d
```

This starts:

- **PostgreSQL** (port 5432)
- **Neon Proxy** (port 4444, provides HTTP interface to Postgres)
- **LocalStack** for AWS services emulation (port 4566)

Verify services are running:

```bash
docker-compose ps
```

### 4. Run Database Migrations

Generate migration files (if schema changed):

```bash
pnpm run db:generate
```

Run migrations:

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5432/main" pnpm run db:migrate
```

Or using the migrations env file:

```bash
pnpm --filter @repo/db db:migrate
```

### 5. Start the Web Application

```bash
pnpm run dev
```

The web app will be available at [http://localhost:3000](http://localhost:3000)

### 6. Deploy the Worker (Local Lambda)

Pull the Lambda runtime image (first time only):

```bash
docker pull public.ecr.aws/lambda/nodejs:20
```

Build and deploy:

```bash
cd apps/worker
pnpm deploy:local
```

Or run the full sequence:

```bash
docker-compose up -d
cd apps/worker
pnpm deploy:local
```

## Service Details

### Web Application (`apps/web`)

**Scripts:**

- `pnpm dev` - Start Next.js dev server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm auth:generate` - Generate Better Auth schema

**Key Dependencies:**

- Next.js 16 with React 19
- Better Auth for authentication
- Drizzle ORM for database
- shadcn/ui components with Radix UI
- TanStack Query for data fetching
- OpenAI SDK for receipt processing
- ExcelJS for report export

### Worker (`apps/worker`)

A Lambda function that processes receipt images from an SQS queue.

**Scripts:**

- `pnpm build` - Bundle Lambda with esbuild
- `pnpm deploy:local` - Deploy to LocalStack
- `pnpm deploy:staging` - Deploy to AWS staging
- `pnpm deploy:prod` - Deploy to AWS production
- `pnpm dev` - Run locally with tsx for development
- `pnpm send:test` - Send a test message to the queue

**Deployment Flow:**

1. Code is bundled with esbuild into `dist/index.js`
2. CDK (Cloud Development Kit) creates/updates Lambda and SQS resources
3. Outputs are written to `cdk-outputs.json`

### Database (`packages/db`)

PostgreSQL with Drizzle ORM.

**Scripts:**

- `pnpm db:generate` - Generate migration files from schema
- `pnpm db:migrate` - Run pending migrations
- `pnpm db:push` - Push schema changes directly (development only)
- `pnpm db:studio` - Open Drizzle Studio GUI

**Schema Files:**

- See `schema.dbml` for entity relationship diagram
- Main tables: `expense_report_jobs`, `receipt_files`, `extracted_expenses`

## Available Workflows

### Development Workflow

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Run migrations
pnpm run db:migrate

# 3. Deploy worker
cd apps/worker && pnpm deploy:local

# 4. Start web app (in new terminal)
pnpm run dev
```

### Testing Worker Locally

```bash
cd apps/worker
pnpm send:test
```

### Database Operations

Access database directly:

```bash
# Via Docker
docker exec -it expense-report-postgres-1 psql -U postgres -d postgres

# Via local psql (after adding hosts entry)
psql -h db.localtest.me -U postgres -d main
```

Open Drizzle Studio:

```bash
pnpm run db:studio
```

### Optional: pgAdmin

Start with pgAdmin for a GUI database client:

```bash
docker-compose --profile pgadmin up -d
```

Access at [http://localhost:5050](http://localhost:5050)

- **Email**: `admin@admin.com`
- **Password**: `admin`

## Troubleshooting

### Database Connection Errors

If you see:

```
[cause]: Error: getaddrinfo ENOTFOUND db.localtest.me
```

Add a hosts entry once:

```bash
sudo nano /etc/hosts
```

Add these lines:

```
127.0.0.1       db.localtest.me
127.0.0.1       localhost.localstack.cloud
127.0.0.1       sqs.us-east-2.localhost
127.0.0.1       s3.us-east-2.localhost
127.0.0.1       lambda.us-east-2.localhost
127.0.0.1       cloudformation.us-east-2.localhost
127.0.0.1       sts.us-east-2.localhost
127.0.0.1       iam.us-east-2.localhost
```

### Docker Services Not Starting

Check container status:

```bash
docker-compose logs postgres
docker-compose logs localstack
docker-compose logs minio
```

Reset everything:

```bash
docker-compose down -v
docker-compose up -d
```

### Worker Deployment Issues

Ensure LocalStack is fully ready before deploying:

```bash
# Wait for LocalStack to be healthy
docker-compose logs -f localstack

# Then deploy
cd apps/worker && pnpm deploy:local
```

## Project Structure

```
.
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App router pages
│   │   ├── components/   # UI components
│   │   ├── server/       # Server-side utilities
│   │   └── ...
│   └── worker/           # Lambda worker
│       ├── index.ts      # Lambda handler
│       ├── infra/        # CDK infrastructure
│       └── scripts/      # Deployment scripts
├── packages/
│   ├── db/               # Database schema and migrations
│   ├── services/         # Shared business logic
│   └── shared/           # Shared types and utilities
├── docker-compose.yml    # Local infrastructure
├── schema.dbml           # Database schema diagram
└── TASKS.md              # Project task tracking
```

## Environment Variables Reference

| Variable                | Description                                       | Used By         |
| ----------------------- | ------------------------------------------------- | --------------- |
| `DATABASE_URL`          | PostgreSQL connection string                      | Web, Worker, DB |
| `S3_ENDPOINT`           | Optional S3 endpoint override (omit for real AWS) | Web, Worker     |
| `S3_BUCKET`             | S3 bucket name                                    | Web, Worker     |
| `S3_REGION`             | S3 bucket region                                  | Web, Worker     |
| `S3_ACCESS_KEY`         | S3 access key                                     | Web, Worker     |
| `S3_SECRET_KEY`         | S3 secret key                                     | Web, Worker     |
| `AWS_ACCESS_KEY_ID`     | AWS access key (use `test` for LocalStack)        | Worker          |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (use `test` for LocalStack)        | Worker          |
| `AWS_DEFAULT_REGION`    | AWS region                                        | Worker          |
| `OPENAI_API_KEY`        | OpenAI API key for receipt extraction             | Worker          |
| `BETTER_AUTH_SECRET`    | Secret for auth token signing                     | Web             |
| `BETTER_AUTH_URL`       | Auth callback URL                                 | Web             |

## Scripts Reference (Root Level)

```bash
pnpm dev              # Start web dev server
pnpm build            # Build web for production
pnpm start            # Start web production server
pnpm db:generate      # Generate database migrations
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Drizzle Studio
```
