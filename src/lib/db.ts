import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Pool único por proceso. En dev Next recarga los módulos en cada cambio,
 * así que se guarda en globalThis para no dejar pools colgados.
 */
const globalForPg = globalThis as unknown as { __sigPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.__sigPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Falta DATABASE_URL");
    globalForPg.__sigPool = new Pool({
      connectionString,
      max: Number(process.env.PGPOOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    globalForPg.__sigPool.on("error", (err) => {
      console.error("[db] error en cliente idle del pool:", err.message);
    });
  }
  return globalForPg.__sigPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}
