// apps/api/src/modules/advisory/advisory-session.repository.ts
// Encrypted persistence for advisory sessions (story 12-3, AC-3, ADR-0016 §3/§4).

import type { ExtendedPrismaClient } from "../../database";
import type { AdvisoryEncryptor } from "./advisory-encryption";
import type {
  AdvisorySession,
  AdvisorySessionData,
  AdvisorySessionSummary,
} from "@pekulo/validators";

export interface AdvisorySessionRepository {
  createSession(args: {
    userId: string;
    snapshotVersion: number;
    model: string;
    provider: string;
    sessionData: AdvisorySessionData;
  }): Promise<AdvisorySession>;

  findLatestByUserId(userId: string): Promise<AdvisorySession | null>;
  listByUserId(userId: string, limit?: number): Promise<AdvisorySessionSummary[]>;
}

// AC-3 (verbatim from story 12-3:19):
//   Given a completed advisory session, When it is stored in advisory_sessions,
//   Then the record carries an ON DELETE CASCADE foreign key to auth.users(id),
//   is protected by a full symmetric RLS quartet (auth.uid() = user_id),
//   has its sensitive payload encrypted at rest with AES-256-GCM, and is registered
//   in id-prefixes.config.ts, settings.export.ts, settings.deletion.ts, and rls-audit.ts.
export function createAdvisorySessionRepository(deps: {
  client: ExtendedPrismaClient;
  encryptor: AdvisoryEncryptor;
}): AdvisorySessionRepository {
  const db = deps.client;

  return {
    async createSession({ userId, snapshotVersion, model, provider, sessionData }) {
      const encrypted = deps.encryptor.encrypt(JSON.stringify(sessionData));
      // The `as unknown as ...` cast bridges the prefixedIds extension's
      // runtime id injection (ADR-0012) — the generated type demands `id`
      // because advisory_sessions declares `id String @id` with no `@default`.
      const row = await db.advisorySession.create({
        data: {
          userId,
          snapshotVersion,
          model,
          provider,
          encryptedPayload: encrypted,
        } as unknown as Parameters<typeof db.advisorySession.create>[0]["data"],
      });

      return {
        id: row.id,
        userId: row.userId,
        snapshotVersion: row.snapshotVersion,
        model: row.model,
        provider: row.provider,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        sessionData,
      };
    },

    async findLatestByUserId(userId) {
      const row = await db.advisorySession.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (!row) return null;

      const decryptedJson = deps.encryptor.decrypt(row.encryptedPayload);
      const sessionData = JSON.parse(decryptedJson) as AdvisorySessionData;

      return {
        id: row.id,
        userId: row.userId,
        snapshotVersion: row.snapshotVersion,
        model: row.model,
        provider: row.provider,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        sessionData,
      };
    },

    async listByUserId(userId, limit = 20) {
      const rows = await db.advisorySession.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return rows.map(
        (row: {
          encryptedPayload: string;
          id: string;
          userId: string;
          snapshotVersion: number;
          model: string;
          provider: string;
          createdAt: Date;
        }) => {
          const decryptedJson = deps.encryptor.decrypt(row.encryptedPayload);
          const data = JSON.parse(decryptedJson) as AdvisorySessionData;
          return {
            id: row.id,
            userId: row.userId,
            snapshotVersion: row.snapshotVersion,
            model: row.model,
            provider: row.provider,
            createdAt: row.createdAt.toISOString(),
            overview: data.analysis.overview,
            recommendationsCount: data.analysis.recommendations.length,
          };
        },
      );
    },
  };
}
