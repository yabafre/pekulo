// apps/api/src/modules/advisory/advisory-encryption.ts
// Field-level AES-256-GCM authenticated encryption for advisory session payloads at rest (story 12-3, AC-3).

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits standard for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag

export interface AdvisoryEncryptor {
  encrypt(plaintext: string): string;
  decrypt(ciphertextPayload: string): string;
}

// AC-3 (verbatim from story 12-3:19):
//   Given a completed advisory session, When it is stored in advisory_sessions,
//   Then the record carries an ON DELETE CASCADE foreign key to auth.users(id),
//   is protected by a full symmetric RLS quartet (auth.uid() = user_id),
//   has its sensitive payload encrypted at rest with AES-256-GCM, and is registered
//   in id-prefixes.config.ts, settings.export.ts, settings.deletion.ts, and rls-audit.ts.
export function createAdvisoryEncryptor(secretKeyHexOrUtf8: string): AdvisoryEncryptor {
  const key = crypto.createHash("sha256").update(secretKeyHexOrUtf8).digest();

  return {
    encrypt(plaintext: string): string {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
    },

    decrypt(ciphertextPayload: string): string {
      const parts = ciphertextPayload.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid ciphertext payload format");
      }
      const [ivB64, tagB64, encryptedB64] = parts;
      const iv = Buffer.from(ivB64!, "base64");
      const tag = Buffer.from(tagB64!, "base64");
      const encrypted = Buffer.from(encryptedB64!, "base64");

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    },
  };
}
