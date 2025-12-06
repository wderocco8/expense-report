import { receipts } from "@/schema";
import { db } from "@/lib/db";

async function main() {
  // Create
  const [newReceipt] = await db
    .insert(receipts)
    .values({
      merchant: "Test Store",
      description: "Test Item",
      amount: "12.34",
    })
    .returning();

  console.log("Created:", newReceipt);

  // Read
  const all = await db.select().from(receipts);
  console.log("All receipts:", all);
}

main();
