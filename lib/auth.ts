import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db/client";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  experimental: { joins: true },
});
