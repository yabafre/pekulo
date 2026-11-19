// apps/mobile/lib/supabase/secure-storage.ts
// Chunked expo-secure-store adapter for @supabase/supabase-js Auth.
// iOS Keychain / expo-secure-store enforces a 2048-byte limit per entry, while
// Supabase session JSON (access_token + refresh_token + user metadata) often
// exceeds 2 KB. Values > CHUNK_SIZE (1800 chars) are split across
// `${key}__chunk_0..N-1` with a manifest `{"__chunked":true,"count":N}` at `key`.

import * as SecureStore from "expo-secure-store";

export const CHUNK_SIZE = 1800;

export interface SecureStoreDriver {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

interface ChunkManifest {
  __chunked: true;
  count: number;
}

function isChunkManifest(raw: string): ChunkManifest | null {
  if (!raw.startsWith('{"__chunked":true,')) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChunkManifest>;
    if (
      parsed["__chunked"] === true &&
      typeof parsed.count === "number" &&
      Number.isInteger(parsed.count) &&
      parsed.count > 0
    ) {
      return { __chunked: true, count: parsed.count };
    }
    return null;
  } catch {
    return null;
  }
}

function chunkKey(baseKey: string, index: number): string {
  return `${baseKey}__chunk_${index}`;
}

export function createChunkedSecureStorage(driver: SecureStoreDriver = SecureStore) {
  async function clearExistingChunks(key: string): Promise<void> {
    const existing = await driver.getItemAsync(key);
    if (!existing) return;
    const manifest = isChunkManifest(existing);
    if (!manifest) return;
    await Promise.all(
      Array.from({ length: manifest.count }, (_, idx) =>
        driver.deleteItemAsync(chunkKey(key, idx)),
      ),
    );
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const raw = await driver.getItemAsync(key);
      if (raw === null) return null;
      const manifest = isChunkManifest(raw);
      if (!manifest) return raw;

      const parts = await Promise.all(
        Array.from({ length: manifest.count }, (_, idx) => driver.getItemAsync(chunkKey(key, idx))),
      );
      if (parts.some((p) => p === null)) {
        return null;
      }
      return parts.join("");
    },

    async setItem(key: string, value: string): Promise<void> {
      await clearExistingChunks(key);

      if (value.length <= CHUNK_SIZE) {
        await driver.setItemAsync(key, value);
        return;
      }

      const chunks: string[] = [];
      for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
        chunks.push(value.slice(offset, offset + CHUNK_SIZE));
      }

      await Promise.all(chunks.map((chunk, idx) => driver.setItemAsync(chunkKey(key, idx), chunk)));
      const manifest: ChunkManifest = { __chunked: true, count: chunks.length };
      await driver.setItemAsync(key, JSON.stringify(manifest));
    },

    async removeItem(key: string): Promise<void> {
      await clearExistingChunks(key);
      await driver.deleteItemAsync(key);
    },
  };
}

export const chunkedSecureStorage = createChunkedSecureStorage();
