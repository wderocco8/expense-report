import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db/client";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  experimental: { joins: true },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false, // NOTE: Don't try to sign in banned users
    // requireEmailVerification: true, // TODO: enable when needed
  },
  plugins: [
    admin({
      defaultRole: "member",
      bannedUserMessage:
        "Your account is pending approval. Please contact support.",
    }),
    nextCookies(),
  ],
  // ✅ Use database hooks to auto-ban new signups
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          if (user.role === "admin") {
            return {
              data: {
                ...user,
                banned: false,
                emailVerified: true,
              },
            };
          }

          // Auto-ban all new users (except admins created via API)
          return {
            data: {
              ...user,
              banned: true,
              banReason: "Pending approval",
              // banExpires: undefined means never expires (until manually unbanned)
            },
          };
        },
      },
    },
  },
});
