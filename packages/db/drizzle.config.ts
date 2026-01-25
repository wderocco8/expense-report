import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/schema/index.ts", // Your schema file path
  out: "./src/drizzle", // Your migrations folder
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "",
  },
});
