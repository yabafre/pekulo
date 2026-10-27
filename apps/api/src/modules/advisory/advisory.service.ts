// Domain service for the advisory access gate (story 12-1, ADR-0016 §4).
// Owns the allowlist decisions; the repository owns persistence and the
// platform guard owns "is this user allowed". Owner membership lives in env
// (config/advisory-owner-ids.ts), never in the database: an owner cannot be
// banned through the API and cannot lock themselves out.
import type { AdvisoryAccessEntry, AdvisoryAccessList, AdvisoryStatus } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";
import { requireAdvisoryAccess } from "../../platform/security";
import type { AdvisoryAccessRepository } from "./advisory.repository";

export interface AdvisoryAccessService {
  isOwner(userId: string): boolean;
  assertAllowed(userId: string): Promise<void>;
  getStatus(userId: string): Promise<AdvisoryStatus>;
  list(actorUserId: string): Promise<AdvisoryAccessList>;
  grant(actorUserId: string, targetUserId: string): Promise<AdvisoryAccessEntry>;
  ban(actorUserId: string, targetUserId: string): Promise<AdvisoryAccessEntry>;
}

export function createAdvisoryService(deps: {
  repository: AdvisoryAccessRepository;
  ownerUserIds: ReadonlySet<string>;
}): AdvisoryAccessService {
  const isOwner = (userId: string): boolean => deps.ownerUserIds.has(userId.trim().toLowerCase());

  function assertOwner(actorUserId: string): void {
    if (!isOwner(actorUserId)) {
      throw new PekuloError("FORBIDDEN", "advisory access management is owner-only");
    }
  }

  function assertNotOwner(targetUserId: string): void {
    if (isOwner(targetUserId)) {
      throw new PekuloError("BAD_REQUEST", "cannot change advisory access of an owner");
    }
  }

  return {
    isOwner,

    async assertAllowed(userId) {
      if (isOwner(userId)) return;
      await requireAdvisoryAccess(deps.repository, userId);
    },

    async getStatus(userId) {
      if (isOwner(userId)) return { access: "active", owner: true };
      const status = await deps.repository.getAccessStatus(userId);
      return { access: status ?? "none", owner: false };
    },

    async list(actorUserId) {
      assertOwner(actorUserId);
      return deps.repository.list();
    },

    async grant(actorUserId, targetUserId) {
      assertOwner(actorUserId);
      assertNotOwner(targetUserId);
      return deps.repository.grant(targetUserId, actorUserId);
    },

    async ban(actorUserId, targetUserId) {
      assertOwner(actorUserId);
      assertNotOwner(targetUserId);
      return deps.repository.ban(targetUserId);
    },
  };
}
