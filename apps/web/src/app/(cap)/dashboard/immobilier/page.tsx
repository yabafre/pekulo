import { RealestateSection } from "./_components/realestate-section";

// Mirrors `portefeuille/page.tsx` shape — no maxWidth cap; the cap-shell
// `main` already applies the 16/8 px lg padding via bento.module.css.
export default function ImmobilierPage() {
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
      <RealestateSection />
    </div>
  );
}
