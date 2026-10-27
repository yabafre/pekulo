import { describe, expect, it, vi, beforeEach } from "vitest";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-2 (verbatim from story 12-4-advisory-private-page:18):
//   Given a non-allowlisted or banned user (status: "none" or "banned"), When they navigate to /dashboard/advisory,
//   Then they cannot reach the surface (server-side gate triggers redirect("/dashboard"), no advisory data leaks to the client, and all underlying Server Actions reject with 403 FORBIDDEN).

const mockStatus = vi.fn();
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}));

vi.mock("@/lib/orpc/modules", () => ({
  advisoryClient: {
    status: () => mockStatus(),
  },
}));

vi.mock("@/lib/orpc/request-context", () => ({
  ensureRequestContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_components/advisory-view", () => ({
  AdvisoryView: () => <div data-testid="advisory-view" />,
}));

import AdvisoryPage from "./page";

describe("AdvisoryPage Server Component Gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AdvisoryView for active allowlisted user (AC-1)", async () => {
    mockStatus.mockResolvedValueOnce({ access: "active", owner: false });
    const jsx = await AdvisoryPage();
    expect(jsx).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard for non-allowlisted user with access none (AC-2)", async () => {
    mockStatus.mockResolvedValueOnce({ access: "none", owner: false });
    await expect(AdvisoryPage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /dashboard for banned user (AC-2)", async () => {
    mockStatus.mockResolvedValueOnce({ access: "banned", owner: false });
    await expect(AdvisoryPage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /dashboard when oRPC status throws 403 (AC-2)", async () => {
    mockStatus.mockRejectedValueOnce(new Error("FORBIDDEN: advisory access required"));
    await expect(AdvisoryPage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
