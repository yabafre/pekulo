// Pure classification of the Bridge Connect v3 callback query string.
// Kept free of React/Next so it can be unit-tested without rendering the RSC.
//
// Bridge redirects back with e.g.
//   ?source=connect&success=true&user_uuid=<uuid>&item_id=<id>&step=sync_success
//   ?source=connect&success=false&user_uuid=<uuid>&step=highlighted_banks  (user bailed)
//   ?...&error_code=<code>                                                 (hard failure)
// "success=false" with no error_code means the user closed/abandoned the
// widget — a cancellation, NOT an error.

export interface BridgeCallbackParams {
  source?: string;
  success?: string;
  step?: string;
  user_uuid?: string;
  item_id?: string;
  error_code?: string;
}

export type BridgeCallbackOutcome =
  | { kind: "complete"; itemId: string; userUuid: string }
  | { kind: "cancelled" }
  | { kind: "error"; errorCode: string };

export function classifyBridgeCallback(params: BridgeCallbackParams): BridgeCallbackOutcome {
  // A hard failure wins over any other signal: Bridge may send success=true
  // alongside an error_code, and a completion must never mask that error.
  if (params.error_code) {
    return { kind: "error", errorCode: params.error_code };
  }
  if (params.success === "true" && params.item_id && params.user_uuid) {
    return { kind: "complete", itemId: params.item_id, userUuid: params.user_uuid };
  }
  return { kind: "cancelled" };
}
