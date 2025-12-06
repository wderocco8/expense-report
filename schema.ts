// schema.ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Example table for receipts
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  merchant: text("merchant").notNull(),
  description: text("description").notNull(),
  amount: text("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type-safe helpers
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
