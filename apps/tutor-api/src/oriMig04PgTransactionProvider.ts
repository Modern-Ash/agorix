import type {
  OriPgTransaction,
  OriPgTransactionProvider,
} from "./oriMig04PostgresAtomicCas.js";

export interface OriPgClient extends OriPgTransaction {
  release(): void;
}
export interface OriPgPool {
  connect(): Promise<OriPgClient>;
}

/**
 * Pins all statements to one client and guarantees rollback on any failure.
 * Never use pool.query inside a transaction callback.
 */
export function createOriPgTransactionProvider(pool: OriPgPool): OriPgTransactionProvider {
  return {
    async transaction<T>(work: (tx: OriPgTransaction) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      let begun = false;
      try {
        await client.query("BEGIN", []);
        begun = true;
        const result = await work(client);
        await client.query("COMMIT", []);
        return result;
      } catch (error) {
        if (begun) {
          try {
            await client.query("ROLLBACK", []);
          } catch {
            // Preserve the original failure; never report transaction success.
          }
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
