import { describe, expect, test } from "bun:test";
import { ADVISORY_SNAPSHOT_SCHEMA_VERSION, advisorySnapshotSchema } from "@pekulo/validators";
import { advisorySnapshotFixture } from "./advisory.test-fixtures";

describe("advisory snapshot schema", () => {
  test("accepts the reference snapshot", () => {
    expect(ADVISORY_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    expect(advisorySnapshotSchema.safeParse(advisorySnapshotFixture()).success).toBe(true);
  });

  test("accepts portfolio: null", () => {
    const fixture = advisorySnapshotFixture();
    expect(advisorySnapshotSchema.safeParse({ ...fixture, portfolio: null }).success).toBe(true);
  });

  test("rejects an unknown schema version", () => {
    const fixture = advisorySnapshotFixture();
    expect(advisorySnapshotSchema.safeParse({ ...fixture, schemaVersion: 2 }).success).toBe(false);
  });

  test("rejects any computation claim other than none", () => {
    const fixture = advisorySnapshotFixture();
    const parsed = advisorySnapshotSchema.safeParse({
      ...fixture,
      fiscalite: { ...fixture.fiscalite, computation: "tax" },
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects a missing allocation block", () => {
    const { allocation, ...rest } = advisorySnapshotFixture();
    expect(allocation).toHaveLength(3);
    expect(advisorySnapshotSchema.safeParse(rest).success).toBe(false);
  });

  test("rejects an invalid holding id", () => {
    const fixture = advisorySnapshotFixture();
    const portfolio = fixture.portfolio;
    if (!portfolio) throw new Error("fixture must include a portfolio");
    const position = portfolio.positions[0];
    if (!position) throw new Error("fixture must include a position");
    const parsed = advisorySnapshotSchema.safeParse({
      ...fixture,
      portfolio: {
        ...portfolio,
        positions: [{ ...position, holdingId: "invalid" }],
      },
    });
    expect(parsed.success).toBe(false);
  });
});
