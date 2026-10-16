import "server-only";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __weretroDb?: DB };

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const useNeon = process.env.DB_DRIVER === "neon" || (process.env.DB_DRIVER !== "pg" && /neon\.tech/.test(url));
  if (useNeon) {
    neonConfig.webSocketConstructor = ws;
    const pool = new NeonPool({ connectionString: url, max: 10 });
    return drizzleNeon({ client: pool, schema }) as unknown as DB;
  }
  const pool = new PgPool({ connectionString: url, max: 10 });
  return drizzlePg({ client: pool, schema });
}

export const db: DB = globalForDb.__weretroDb ?? (globalForDb.__weretroDb = createDb());
export { schema };
