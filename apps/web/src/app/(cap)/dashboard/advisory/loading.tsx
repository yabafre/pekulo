import { PekuloSkeleton } from "@pekulo/ui";

export default function AdvisoryLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "16px 8px",
        width: "100%",
        maxWidth: 880,
        margin: "0 auto",
      }}
    >
      <PekuloSkeleton block height={100} />
      <PekuloSkeleton block height={48} width="60%" />
      <PekuloSkeleton block height={180} />
      <PekuloSkeleton block height={240} />
    </div>
  );
}
