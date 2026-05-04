"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hypothesesSchema, type Hypotheses } from "@pekulo/validators";
import { hypothesisClient } from "@/lib/orpc/modules";
import { hypothesesTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 0-6: action becomes a thin oRPC delegator. apps/api owns the row
// mapping (rowToHypotheses / hypothesesToWriteData) + Prisma upsert. ctx
// still carries `supabase` + `userId` + `email` for brownfield siblings,
// but neither this action nor `apps/web/src/lib/data/hypotheses.ts` use
// them anymore — both go through hypothesisClient.

export const getHypotheses = defineAction<void, Hypotheses, ActionContext>({
  name: "getHypotheses",
  input: z.void(),
  handler: async () => {
    return hypothesisClient.get();
  },
});

export const saveHypotheses = defineAction<Hypotheses, Hypotheses, ActionContext>({
  name: "saveHypotheses",
  input: hypothesesSchema,
  output: hypothesesSchema,
  tags: [hypothesesTags.current()],
  handler: async ({ input }) => {
    const persisted = await hypothesisClient.save(input);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/parametres");
    return persisted;
  },
});
