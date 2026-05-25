import { PekuloSkeleton, Section, pekuloSpacing } from "@pekulo/ui";

export default function TransactionsLoading() {
  return (
    <div
      style={{
        display: "flex",
        padding: pekuloSpacing[4],
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <Section ariaLabel="Chargement des transactions">
          <PekuloSkeleton lines={3} height={48} />
        </Section>
      </div>
    </div>
  );
}
