CREATE TYPE "public"."category" AS ENUM('tolls/parking', 'hotel', 'transport', 'fuel', 'meals', 'phone', 'supplies', 'misc');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "expense_report_jobs_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Expense report' NOT NULL,
	"status" "status" DEFAULT 'pending' NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"processed_files" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_expenses_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"merchant" text,
	"description" text,
	"date" date,
	"amount" numeric(10, 2) NOT NULL,
	"category" "category" NOT NULL,
	"transport_details" jsonb,
	"raw_json" jsonb,
	"model_version" text NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_files_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"s3_url" text NOT NULL,
	"original_filename" text,
	"status" "status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "extracted_expenses_table" ADD CONSTRAINT "extracted_expenses_table_receipt_id_receipt_files_table_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt_files_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_files_table" ADD CONSTRAINT "receipt_files_table_job_id_expense_report_jobs_table_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."expense_report_jobs_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_active_receipt" ON "extracted_expenses_table" USING btree ("receipt_id") WHERE "extracted_expenses_table"."is_current" = $1;