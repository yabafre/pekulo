// oRPC handlers for the private advisory access gate (story 12-1, ADR-0016 §4).
// Every procedure is gated by the same .use() middleware: the gate runs
// before any handler, so a non-allowlisted caller cannot compute advisory
// data (AC-1) and a ban is effective on the next request with no cache to
// invalidate (AC-3). Future procedures added to this router inherit the
// gate by construction.
import { implement } from "@orpc/server";
import { advisoryContract } from "@pekulo/contracts";
import { isPekuloError, PekuloError } from "../../common/errors";
import type { AdvisoryAccessService } from "./advisory.service";
import type { AdvisoryAnalysisService } from "./advisory-analysis.service";

const impl = implement(advisoryContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createAdvisoryRouter(deps: {
  service: AdvisoryAccessService;
  analysis: AdvisoryAnalysisService;
}) {
  const gated = impl.use(async ({ context, errors, next }) => {
    try {
      requireUserId(context.userId);
      await deps.service.assertAllowed(context.userId);
    } catch (err) {
      // Re-thrown as the contract's typed errors: oRPC collapses any other
      // throw to 500 inside handler.handle(), before the mount's mapper runs.
      if (isPekuloError(err) && err.code === "FORBIDDEN") {
        throw errors.FORBIDDEN({ message: err.message });
      }
      if (isPekuloError(err) && err.code === "UNAUTHORIZED") {
        throw errors.UNAUTHORIZED({ message: err.message });
      }
      throw err;
    }
    return next();
  });

  return gated.router({
    status: gated.status.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.getStatus(context.userId);
    }),

    grant: gated.grant.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.grant(context.userId, input.userId);
      } catch (err) {
        if (isPekuloError(err) && err.code === "FORBIDDEN") {
          throw errors.FORBIDDEN({ message: err.message });
        }
        if (isPekuloError(err) && err.code === "BAD_REQUEST") {
          throw errors.BAD_REQUEST({ message: err.message });
        }
        throw err;
      }
    }),

    ban: gated.ban.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.ban(context.userId, input.userId);
      } catch (err) {
        if (isPekuloError(err) && err.code === "FORBIDDEN") {
          throw errors.FORBIDDEN({ message: err.message });
        }
        if (isPekuloError(err) && err.code === "BAD_REQUEST") {
          throw errors.BAD_REQUEST({ message: err.message });
        }
        throw err;
      }
    }),

    list: gated.list.handler(async ({ context, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.list(context.userId);
      } catch (err) {
        if (isPekuloError(err) && err.code === "FORBIDDEN") {
          throw errors.FORBIDDEN({ message: err.message });
        }
        throw err;
      }
    }),

    snapshot: gated.snapshot.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.analysis.getSnapshot(context.userId);
    }),

    generateAnalysis: gated.generateAnalysis.handler(async ({ context }) => {
      requireUserId(context.userId);
      throw new PekuloError("INTERNAL", "Not implemented yet");
    }),

    getLatestSession: gated.getLatestSession.handler(async ({ context }) => {
      requireUserId(context.userId);
      return null;
    }),

    listSessions: gated.listSessions.handler(async ({ context }) => {
      requireUserId(context.userId);
      return { sessions: [], totalCount: 0 };
    }),
  });
}
