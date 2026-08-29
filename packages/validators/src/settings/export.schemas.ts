// Zod source of truth for the GDPR export envelope (story 11-1, FR-49).
// Mirrors docs/exports/schema-v1.json — the published artefact NFR-30 names.
// The per-node `rows` array stays `z.record`-loose on purpose: the export is a
// faithful row dump, and pinning 21 row shapes here would duplicate the Prisma
// schema and rot on the first migration. Structure is validated; row contents
// are the database's business.
import { z } from "@pekulo/zod";

// Envelope version — bumped only when the DOCUMENT shape changes.
export const EXPORT_SCHEMA_VERSION = "1.0.0";
// Node version — bumped when a NODE's shape changes, independently of the document.
export const EXPORT_NODE_SCHEMA_VERSION = "1";

export const exportIdentitySchema = z.object({
  schema_version: z.string(),
  user_id: z.string().uuid(),
  email: z.string().nullable(),
});
export type ExportIdentity = z.infer<typeof exportIdentitySchema>;

export const exportNodeSchema = z.object({
  schema_version: z.string(),
  rows: z.array(z.record(z.string(), z.unknown())),
});
export type ExportNodePayload = z.infer<typeof exportNodeSchema>;

export const userDataExportSchema = z
  .object({
    schema_version: z.literal(EXPORT_SCHEMA_VERSION),
    generated_at: z.string(),
    identity: exportIdentitySchema,
  })
  .catchall(exportNodeSchema);
export type UserDataExport = z.infer<typeof userDataExportSchema>;
