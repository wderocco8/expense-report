CREATE TYPE "public"."receipt_status" AS ENUM('pending', 'ocr_processing', 'ocr_complete', 'extracting', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "ocr_results_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"extracted_text" jsonb NOT NULL,
	"provider" text,
	"confidence" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "receipt_files_table" RENAME COLUMN "processed_at" TO "ocr_completed_at";--> statement-breakpoint
ALTER TABLE "receipt_files_table" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
UPDATE "receipt_files_table" SET "status" = 'failed' WHERE "status" = 'processing';--> statement-breakpoint
ALTER TABLE "receipt_files_table" ALTER COLUMN "status" SET DATA TYPE "public"."receipt_status" USING "status"::text::"public"."receipt_status";--> statement-breakpoint
ALTER TABLE "receipt_files_table" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."receipt_status";--> statement-breakpoint
DROP TYPE "public"."status";--> statement-breakpoint
ALTER TABLE "extracted_expenses_table" ADD COLUMN "ocr_result_id" uuid;--> statement-breakpoint
ALTER TABLE "receipt_files_table" ADD COLUMN "ocr_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "receipt_files_table" ADD COLUMN "extraction_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "receipt_files_table" ADD COLUMN "extraction_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "ocr_results_table" ADD CONSTRAINT "ocr_results_table_receipt_id_receipt_files_table_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt_files_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_expenses_table" ADD CONSTRAINT "extracted_expenses_table_ocr_result_id_ocr_results_table_id_fk" FOREIGN KEY ("ocr_result_id") REFERENCES "public"."ocr_results_table"("id") ON DELETE set null ON UPDATE no action;