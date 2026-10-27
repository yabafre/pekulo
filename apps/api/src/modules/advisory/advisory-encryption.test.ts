// apps/api/src/modules/advisory/advisory-encryption.test.ts
// Tests for authenticated AES-256-GCM encryption helper (story 12-3, AC-3).

import { describe, expect, it } from "bun:test";
import { createAdvisoryEncryptor } from "./advisory-encryption";

// AC-3 (verbatim from story 12-3:19):
//   Given a completed advisory session, When it is stored in advisory_sessions,
//   Then the record carries an ON DELETE CASCADE foreign key to auth.users(id),
//   is protected by a full symmetric RLS quartet (auth.uid() = user_id),
//   has its sensitive payload encrypted at rest with AES-256-GCM, and is registered
//   in id-prefixes.config.ts, settings.export.ts, settings.deletion.ts, and rls-audit.ts.
describe("createAdvisoryEncryptor (story 12-3)", () => {
  const secretKey = "test-advisory-secret-key-32-chars-minimum!";
  const encryptor = createAdvisoryEncryptor(secretKey);

  it("successfully round-trips plaintext through encrypt and decrypt", () => {
    const plaintext = JSON.stringify({
      wealth: { totalEur: 125000 },
      recommendations: ["Buy CW8"],
    });

    const encrypted = encryptor.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = encryptor.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces distinct ciphertexts for identical plaintext due to random IV", () => {
    const text = "constant financial payload";
    const enc1 = encryptor.encrypt(text);
    const enc2 = encryptor.encrypt(text);

    expect(enc1).not.toBe(enc2);
    expect(encryptor.decrypt(enc1)).toBe(text);
    expect(encryptor.decrypt(enc2)).toBe(text);
  });

  it("throws when ciphertext payload is malformed or tampered", () => {
    expect(() => encryptor.decrypt("invalid-payload-format")).toThrow(
      "Invalid ciphertext payload format",
    );

    const validEncrypted = encryptor.encrypt("secret message");
    const [iv, tag, ciphertext] = validEncrypted.split(":");

    // Tampered ciphertext
    const tamperedCiphertext = Buffer.from("tampered bytes").toString("base64");
    expect(() => encryptor.decrypt(`${iv}:${tag}:${tamperedCiphertext}`)).toThrow();

    // Tampered tag
    const tamperedTag = Buffer.from("invalid-tag-16b!").toString("base64");
    expect(() => encryptor.decrypt(`${iv}:${tamperedTag}:${ciphertext}`)).toThrow();
  });

  it("handles empty string round-trip safely", () => {
    const encrypted = encryptor.encrypt("");
    const decrypted = encryptor.decrypt(encrypted);
    expect(decrypted).toBe("");
  });
});
