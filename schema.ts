import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  date,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

const categoryEnum = pgEnum("category", [
  "tolls/parking",
  "hotel",
  "transport",
  "fuel",
  "meals",
  "phone",
  "supplies",
  "misc",
]);

// Example table for receipts
export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  merchant: text("merchant"),
  description: text("description"),
  date: date("date"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: categoryEnum("category").notNull(),
  transportDetails: jsonb("transport_details").$type<{
    mode: "train" | "car" | "plane" | null;
    mileage: number | null;
  } | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type-safe helpers
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
