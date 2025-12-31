import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db/client";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  experimental: { joins: true },
  advanced: {
    database: {
      generateId: "uuid", // Use UUID generation
    },
  },
  user: {
    additionalFields: {
      status: {
        type: "string",
        required: false,
        defaultValue: "pending",
        input: false, // Users can't set this themselves
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "member",
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
});
