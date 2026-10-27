import { PekuloSkeleton, Section } from "@pekulo/ui";

export default function AdvisoryLoading() {
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
      <Section ariaLabel="Chargement du conseil financier">
        <PekuloSkeleton width="40%" height={12} />
        <div style={{ height: 12 }} />
        <PekuloSkeleton block height={120} />
        <div style={{ height: 16 }} />
        <PekuloSkeleton lines={3} height={32} />
      </Section>
    </div>
  );
}
