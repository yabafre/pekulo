// Private advisory-surface access contract (story 12-1, ADR-0016 §4).
// Mounted under /rpc/v1/advisory by ADR-0009's oRPC mount.
//
// Every procedure both (a) passes the access gate — an owner-only middleware
// in apps/api — and (b) maps the service's FORBIDDEN/BAD_REQUEST to a typed
// error. UNAUTHORIZED is declared for the defensive missing-context branch;
// mountOrpc already rejects a request without a valid JWT with 401.
import { oc } from "@orpc/contract";
import {
  advisoryAccessEntrySchema,
  advisoryAccessListSchema,
  advisorySessionListSchema,
  advisorySessionSchema,
  advisorySnapshotSchema,
  advisoryStatusSchema,
  advisoryTargetInputSchema,
  generateAnalysisInputSchema,
} from "@pekulo/validators";

const forbiddenError = {
  status: 403 as const,
  message: "advisory surface is restricted to allowlisted users",
};
const badRequestError = {
  status: 400 as const,
  message: "cannot change advisory access of an owner",
};
const unauthorizedError = {
  status: 401 as const,
  message: "authentication required",
};

const advisoryErrors = {
  FORBIDDEN: forbiddenError,
  BAD_REQUEST: badRequestError,
  UNAUTHORIZED: unauthorizedError,
} as const;

export const advisoryContractV1 = {
  status: oc.output(advisoryStatusSchema).errors(advisoryErrors),
  snapshot: oc.output(advisorySnapshotSchema).errors(advisoryErrors),
  grant: oc
    .input(advisoryTargetInputSchema)
    .output(advisoryAccessEntrySchema)
    .errors(advisoryErrors),
  ban: oc.input(advisoryTargetInputSchema).output(advisoryAccessEntrySchema).errors(advisoryErrors),
  list: oc.output(advisoryAccessListSchema).errors(advisoryErrors),
  // AC-5 (verbatim from story 12-3:21):
  //   Given the new advisory procedures (generateAnalysis, getLatestSession, listSessions),
  //   When called via /rpc/v1/advisory, Then they inherit the access gate from story 12-1
  //   (403 for non-allowlisted or banned users) before any snapshot or LLM call is triggered.
  generateAnalysis: oc
    .input(generateAnalysisInputSchema)
    .output(advisorySessionSchema)
    .errors(advisoryErrors),
  getLatestSession: oc.output(advisorySessionSchema.nullable()).errors(advisoryErrors),
  listSessions: oc.output(advisorySessionListSchema).errors(advisoryErrors),
} as const;

export const advisoryContract = advisoryContractV1;
export const advisoryContractMeta = {
  moduleKey: "advisory",
  mountPath: "/rpc/v1/advisory",
  version: "v1",
} as const;
