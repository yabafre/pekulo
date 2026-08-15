// AC-1 — the shell can only be cached if the worker is actually registered.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import { ServiceWorkerRegistrar } from "./service-worker-registrar";

const ORIGINAL_ENV = process.env.NODE_ENV;
const registerMock = vi.fn();

beforeEach(() => {
  registerMock.mockReset().mockResolvedValue({});
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register: registerMock },
    configurable: true,
  });
  Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
});

afterEach(() => {
  Object.defineProperty(process.env, "NODE_ENV", {
    value: ORIGINAL_ENV,
    configurable: true,
    writable: true,
    enumerable: true,
  });
});

describe("ServiceWorkerRegistrar (story 9-2)", () => {
  test("registers /sw.js at the root scope in production", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
      writable: true,
      enumerable: true,
    });
    render(<ServiceWorkerRegistrar />);
    expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  test("registers nothing outside production", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
      writable: true,
      enumerable: true,
    });
    render(<ServiceWorkerRegistrar />);
    expect(registerMock).not.toHaveBeenCalled();
  });

  test("a rejected registration does not throw", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
      writable: true,
      enumerable: true,
    });
    registerMock.mockRejectedValue(new Error("insecure context"));
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
    await Promise.resolve();
  });

  test("renders no DOM", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
      writable: true,
      enumerable: true,
    });
    const { container } = render(<ServiceWorkerRegistrar />);
    expect(container).toBeEmptyDOMElement();
  });
});
