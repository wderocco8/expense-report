import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

let connectionString = process.env.DATABASE_URL;

// Local dev setup
if (process.env.NODE_ENV === "development") {
  connectionString = "postgres://postgres:postgres@db.localtest.me:5432/main";
  neonConfig.fetchEndpoint = (host) => {
    const [protocol, port] =
      host === "db.localtest.me" ? ["http", 4444] : ["https", 443];
    return `${protocol}://${host}:${port}/sql`;
  };
  const connectionStringUrl = new URL(connectionString);
  neonConfig.useSecureWebSocket =
    connectionStringUrl.hostname !== "db.localtest.me";
  neonConfig.wsProxy = (host) =>
    host === "db.localtest.me" ? `${host}:4444/v2` : `${host}/v2`;
}

neonConfig.webSocketConstructor = ws;

if (!connectionString) {
  throw new Error("Database connectionString is not defined");
}

export const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
export const pool = new Pool({ connectionString });
