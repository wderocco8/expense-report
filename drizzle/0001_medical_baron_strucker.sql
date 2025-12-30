ALTER TABLE "app_user" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "extracted_expenses_table" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "receipt_files_table" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;