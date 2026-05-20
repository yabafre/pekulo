import { PortfolioSection } from "./_components/portfolio-section";

export default function PortefeuillePage() {
  // No maxWidth cap — portfolio is a multi-column screen and should fill
  // the cap-shell `main` (16 px / 8 px lg padding already applied by
  // bento.module.css .main). Mirrors ux-preview L1459 (no maxWidth on
  // the PortfolioScreen container).
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "8px 4px 0",
        width: "100%",
      }}
    >
      <PortfolioSection />
    </div>
  );
}
