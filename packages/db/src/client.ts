import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Database connectionString is not defined");
}

// Local dev setup
if (process.env.NODE_ENV === "development") {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.wsProxy = (host) => `${host}:4444/v2`;
}

neonConfig.webSocketConstructor = ws;

export const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
export const pool = new Pool({ connectionString });
