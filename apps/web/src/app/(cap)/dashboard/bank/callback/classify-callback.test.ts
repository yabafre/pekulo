import { describe, expect, test } from "vitest";
import { classifyBridgeCallback } from "./classify-callback";

// Bridge v3 redirects back to this callback with a query string. The widget
// finalises token exchange server-side; we only classify the outcome.
//   success=true&item_id=<id>&user_uuid=<uuid>            → complete
//   success=false&step=highlighted_banks&user_uuid=<uuid> → user cancelled
//   ...&error_code=<code>                                 → hard error
describe("classifyBridgeCallback", () => {
  test("success=true with item_id + user_uuid → complete", () => {
    expect(
      classifyBridgeCallback({ success: "true", item_id: "item-1", user_uuid: "uuid-1" }),
    ).toEqual({ kind: "complete", itemId: "item-1", userUuid: "uuid-1" });
  });

  test("success=false without error_code → cancelled (user abandoned the widget)", () => {
    expect(
      classifyBridgeCallback({
        source: "connect",
        success: "false",
        step: "highlighted_banks",
        user_uuid: "uuid-1",
      }),
    ).toEqual({ kind: "cancelled" });
  });

  test("no params at all → cancelled (not an alarming error)", () => {
    expect(classifyBridgeCallback({})).toEqual({ kind: "cancelled" });
  });

  test("error_code present → error, even when success is false", () => {
    expect(classifyBridgeCallback({ success: "false", error_code: "ACCOUNT_LOCKED" })).toEqual({
      kind: "error",
      errorCode: "ACCOUNT_LOCKED",
    });
  });

  test("error_code present with success=true → error (hard failure wins over completion)", () => {
    expect(
      classifyBridgeCallback({
        success: "true",
        item_id: "item-1",
        user_uuid: "uuid-1",
        error_code: "SCA_FAILED",
      }),
    ).toEqual({ kind: "error", errorCode: "SCA_FAILED" });
  });

  test("success=true but missing item_id (partial) → cancelled, not complete", () => {
    expect(classifyBridgeCallback({ success: "true", user_uuid: "uuid-1" }).kind).toBe("cancelled");
  });
});
