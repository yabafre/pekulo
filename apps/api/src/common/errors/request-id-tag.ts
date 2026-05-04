// apps/api/src/common/errors/request-id-tag.ts
// Tag a thrown error with the mount-side requestId so the global Elysia
// .onError shapes the wire body with the SAME id that the mount-side
// structured log captured. Avoids the two-requestIds-per-failure split
// flagged in story 0-6 review.
//
// The tag is a non-enumerable string property — invisible to JSON.stringify
// (so it never accidentally leaks into log payloads or wire bodies) but
// readable by `extractRequestId`.

const TAG = "__pekuloRequestId";

export function attachRequestId(err: unknown, requestId: string): void {
  if (err && typeof err === "object") {
    Object.defineProperty(err, TAG, {
      value: requestId,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  }
}

export function extractRequestId(err: unknown): string | undefined {
  if (err && typeof err === "object" && TAG in err) {
    const value = (err as Record<string, unknown>)[TAG];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}
