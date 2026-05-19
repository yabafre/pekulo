import { PortfolioSection } from "./_components/portfolio-section";

export default function PortefeuillePage() {
  return (
    <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 1024,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <PortfolioSection />
      </div>
    </div>
  );
}
