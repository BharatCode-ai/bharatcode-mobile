import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { Credentials, Database } from "./conversation-store";
export const credentials: Credentials = {
  get: async (id) =>
    (await SecureStore.getItemAsync(`bharatcode.${id}`)) ?? undefined,
  set: (id, token) => SecureStore.setItemAsync(`bharatcode.${id}`, token),
  remove: (id) => SecureStore.deleteItemAsync(`bharatcode.${id}`),
};
export async function openDatabase(): Promise<Database> {
  const db = await SQLite.openDatabaseAsync("bharatcode-v1.db");
  await db.execAsync(
    "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); PRAGMA user_version = 1;",
  );
  let queue: Promise<unknown> = Promise.resolve();
  return {
    get: async (key) =>
      (
        await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM kv WHERE key = ?",
          key,
        )
      )?.value,
    set: async (key, value) => {
      await db.runAsync(
        "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        key,
        value,
      );
    },
    removePrefix: async (prefix) => {
      await db.runAsync(
        "DELETE FROM kv WHERE substr(key,1,?) = ?",
        prefix.length,
        prefix,
      );
    },
    transaction<T>(work: () => Promise<T>): Promise<T> {
      const next = queue
        .catch(() => {})
        .then(async () => {
          let result!: T;
          await db.withTransactionAsync(async () => {
            result = await work();
          });
          return result;
        });
      queue = next;
      return next;
    },
  };
}
