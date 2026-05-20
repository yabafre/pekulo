import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSkeleton } from "./PekuloSkeleton";

describe("PekuloSkeleton snapshot", () => {
  it("renders single line", () => {
    const { container } = renderWithTamagui(<PekuloSkeleton />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `
      "<span class="_dsp_contents  font_body"><style>@keyframes pekulo-skeleton-pulse {
        0%, 100% { opacity: 0.6 }
        50% { opacity: 0.3 }
      }</style><div aria-hidden="true" class="is_View _fd-column _gap-6px"><div class="is_View _height-16px _width-10037 _btlr-c-radius-sm _btrr-c-radius-sm _bbrr-c-radius-sm _bblr-c-radius-sm _bg-backgroundM3600254" style="animation: pekulo-skeleton-pulse 1.5s ease-in-out infinite;"></div></div><div style="display: contents;"></div></span>"
    `,
    );
  });
  it("renders 3 lines", () => {
    const { container } = renderWithTamagui(<PekuloSkeleton lines={3} />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `
      "<span class="_dsp_contents  font_body"><style>@keyframes pekulo-skeleton-pulse {
        0%, 100% { opacity: 0.6 }
        50% { opacity: 0.3 }
      }</style><div aria-hidden="true" class="is_View _fd-column _gap-6px"><div class="is_View _height-16px _width-10037 _btlr-c-radius-sm _btrr-c-radius-sm _bbrr-c-radius-sm _bblr-c-radius-sm _bg-backgroundM3600254" style="animation: pekulo-skeleton-pulse 1.5s ease-in-out infinite;"></div><div class="is_View _height-16px _width-8837 _btlr-c-radius-sm _btrr-c-radius-sm _bbrr-c-radius-sm _bblr-c-radius-sm _bg-backgroundM3600254" style="animation: pekulo-skeleton-pulse 1.5s ease-in-out infinite;"></div><div class="is_View _height-16px _width-7637 _btlr-c-radius-sm _btrr-c-radius-sm _bbrr-c-radius-sm _bblr-c-radius-sm _bg-backgroundM3600254" style="animation: pekulo-skeleton-pulse 1.5s ease-in-out infinite;"></div></div><div style="display: contents;"></div></span>"
    `,
    );
  });
  it("renders block", () => {
    const { container } = renderWithTamagui(<PekuloSkeleton block height={120} />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `
      "<span class="_dsp_contents  font_body"><style>@keyframes pekulo-skeleton-pulse {
        0%, 100% { opacity: 0.6 }
        50% { opacity: 0.3 }
      }</style><div aria-hidden="true" class="is_View _width-10037 _height-120px _btlr-c-radius-md _btrr-c-radius-md _bbrr-c-radius-md _bblr-c-radius-md _bg-backgroundM3600254" style="animation: pekulo-skeleton-pulse 1.5s ease-in-out infinite;"></div><div style="display: contents;"></div></span>"
    `,
    );
  });
});
