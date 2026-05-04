// base62.ts — random base62 string for prefixed IDs.
//
// 21 chars × log2(62) ≈ 125 bits of entropy. Modulo bias on `byte % 62` is
// negligible for ID purposes (slight overrepresentation of the first 8 chars
// of the alphabet by a factor of 5/4 vs the last 54). Acceptable trade-off
// vs rejection sampling for non-cryptographic ID generation.

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateBase62Id(length: number): string {
  if (length <= 0) {
    throw new RangeError(`generateBase62Id: length must be positive, got ${length}`);
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += BASE62_ALPHABET[bytes[i]! % 62];
  }
  return id;
}
