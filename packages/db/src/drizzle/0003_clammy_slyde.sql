ALTER TABLE "ocr_results_table" ADD COLUMN "s3_raw_key" text;--> statement-breakpoint
ALTER TABLE "ocr_results_table" DROP COLUMN "raw_response";