// packages/contracts/src/transactions/transactions.contract.ts
// Transactions module oRPC contract (story 5-1). 5 procedures: CRUD on
// transactions with cross-account ownership guard (ACCOUNT_NOT_FOUND) and
// non-idempotent delete (TRANSACTION_NOT_FOUND). Mount under
// /rpc/v1/transactions per ADR-0009.

import { oc } from "@orpc/contract";
import {
  createTransactionInputSchema,
  deleteTransactionInputSchema,
  getTransactionInputSchema,
  listTransactionsInputSchema,
  listTransactionsOutputSchema,
  transactionSchema,
  transactionsOkSchema,
  updateTransactionInputSchema,
} from "@pekulo/validators";

const transactionNotFoundError = {
  status: 404 as const,
  message: "transaction not found",
};
const accountNotFoundError = {
  status: 404 as const,
  message: "account not found",
};

export const transactionsContractV1 = {
  createTransaction: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(createTransactionInputSchema)
    .output(transactionSchema),
  updateTransaction: oc
    .errors({
      TRANSACTION_NOT_FOUND: transactionNotFoundError,
      ACCOUNT_NOT_FOUND: accountNotFoundError,
    })
    .input(updateTransactionInputSchema)
    .output(transactionSchema),
  deleteTransaction: oc
    .errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError })
    .input(deleteTransactionInputSchema)
    .output(transactionsOkSchema),
  getTransaction: oc
    .errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError })
    .input(getTransactionInputSchema)
    .output(transactionSchema),
  listTransactions: oc.input(listTransactionsInputSchema).output(listTransactionsOutputSchema),
} as const;

export const transactionsContract = transactionsContractV1;
export const transactionsContractMeta = {
  moduleKey: "transactions",
  mountPath: "/rpc/v1/transactions",
  version: "v1",
} as const;
