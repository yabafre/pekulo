// apps/api/src/modules/transactions/transactions.routes.ts
// oRPC handler wiring for the 5 procedures (story 5-1). Mirrors
// realestate.routes.ts — typed contract errors (TRANSACTION_NOT_FOUND,
// ACCOUNT_NOT_FOUND) are rethrown via the handler's `errors.*` constructors
// so oRPC's RPCHandler propagates them as canonical defined-error JSON.
// Without this remap, RPCHandler would mask the PekuloError as
// INTERNAL_SERVER_ERROR before the Elysia .onError mapper sees it.
//
// L8 invariant (story 5-1 explicit): router type is inferred via
// ReturnType<typeof createTransactionsRouter>; never annotate as `Elysia`.

import { implement } from "@orpc/server";
import { transactionsContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { TransactionsService } from "./transactions.service";

const impl = implement(transactionsContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createTransactionsRouter(deps: { service: TransactionsService }) {
  return impl.router({
    createTransaction: impl.createTransaction.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.createTransaction(context.userId, input);
      } catch (err) {
        if (err instanceof PekuloError && err.code === "ACCOUNT_NOT_FOUND") {
          throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    updateTransaction: impl.updateTransaction.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.updateTransaction(context.userId, input);
      } catch (err) {
        if (err instanceof PekuloError) {
          if (err.code === "TRANSACTION_NOT_FOUND") {
            throw errors.TRANSACTION_NOT_FOUND({ message: err.message });
          }
          if (err.code === "ACCOUNT_NOT_FOUND") {
            throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
          }
        }
        throw err;
      }
    }),

    deleteTransaction: impl.deleteTransaction.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.deleteTransaction(context.userId, input);
      } catch (err) {
        if (err instanceof PekuloError && err.code === "TRANSACTION_NOT_FOUND") {
          throw errors.TRANSACTION_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    getTransaction: impl.getTransaction.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.getTransaction(context.userId, input);
      } catch (err) {
        if (err instanceof PekuloError && err.code === "TRANSACTION_NOT_FOUND") {
          throw errors.TRANSACTION_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    listTransactions: impl.listTransactions.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.listTransactions(context.userId, input);
    }),

    previewImportCsv: impl.previewImportCsv.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.previewImportCsv(context.userId, input);
      } catch (err) {
        if (err instanceof PekuloError) {
          if (err.code === "INVALID_CSV") {
            throw errors.INVALID_CSV({ message: err.message });
          }
          if (err.code === "PAYLOAD_TOO_LARGE") {
            throw errors.PAYLOAD_TOO_LARGE({ message: err.message });
          }
        }
        throw err;
      }
    }),

    importCsv: impl.importCsv.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.importCsv(context.userId, input);
      } catch (err) {
        if (err instanceof PekuloError && err.code === "ACCOUNT_NOT_FOUND") {
          throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    confirmCategorisation: impl.confirmCategorisation.handler(
      async ({ context, input, errors }) => {
        requireUserId(context.userId);
        try {
          return await deps.service.confirmCategorisation(context.userId, input);
        } catch (err) {
          if (err instanceof PekuloError && err.code === "TRANSACTION_NOT_FOUND") {
            throw errors.TRANSACTION_NOT_FOUND({ message: err.message });
          }
          throw err;
        }
      },
    ),

    listPendingSuggestions: impl.listPendingSuggestions.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.listPendingSuggestions(context.userId);
    }),
  });
}
