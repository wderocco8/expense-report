CREATE TYPE "public"."app_user_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."app_user_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."receipt_status" AS ENUM('pending', 'ocr_processing', 'ocr_complete', 'extracting', 'complete', 'needs_review', 'failed');--> statement-breakpoint
CREATE TABLE "expense_report_jobs_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"schema_version_id" uuid NOT NULL,
	"title" text DEFAULT 'Expense report' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_expenses_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"ocr_result_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"date" date,
	"extracted_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_json" jsonb,
	"model_version" text NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_results_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"extracted_text" jsonb NOT NULL,
	"provider" text,
	"confidence" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_files_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"original_filename" text,
	"status" "receipt_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"ocr_started_at" timestamp,
	"ocr_completed_at" timestamp,
	"extraction_started_at" timestamp,
	"extraction_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_versions_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemas_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_usage_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" date NOT NULL,
	"receipts_processed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_report_jobs_table" ADD CONSTRAINT "expense_report_jobs_table_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_report_jobs_table" ADD CONSTRAINT "expense_report_jobs_table_schema_version_id_schema_versions_table_id_fk" FOREIGN KEY ("schema_version_id") REFERENCES "public"."schema_versions_table"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_expenses_table" ADD CONSTRAINT "extracted_expenses_table_receipt_id_receipt_files_table_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt_files_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_expenses_table" ADD CONSTRAINT "extracted_expenses_table_ocr_result_id_ocr_results_table_id_fk" FOREIGN KEY ("ocr_result_id") REFERENCES "public"."ocr_results_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_results_table" ADD CONSTRAINT "ocr_results_table_receipt_id_receipt_files_table_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt_files_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_files_table" ADD CONSTRAINT "receipt_files_table_job_id_expense_report_jobs_table_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."expense_report_jobs_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_versions_table" ADD CONSTRAINT "schema_versions_table_schema_id_schemas_table_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemas_table" ADD CONSTRAINT "schemas_table_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_usage_table" ADD CONSTRAINT "user_usage_table_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_user_id_idx" ON "expense_report_jobs_table" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_active_receipt" ON "extracted_expenses_table" USING btree ("receipt_id") WHERE "extracted_expenses_table"."is_current" = true;--> statement-breakpoint
CREATE INDEX "extracted_expenses_date_idx" ON "extracted_expenses_table" USING btree ("date");--> statement-breakpoint
CREATE INDEX "ocr_results_receipt_id_idx" ON "ocr_results_table" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipt_files_job_id_idx" ON "receipt_files_table" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "receipt_files_status_idx" ON "receipt_files_table" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schema_versions_schema_id_idx" ON "schema_versions_table" USING btree ("schema_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schema_versions_schema_version_unique" ON "schema_versions_table" USING btree ("schema_id","version_number");--> statement-breakpoint
CREATE INDEX "schemas_user_id_idx" ON "schemas_table" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_usage_user_period_unique" ON "user_usage_table" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");