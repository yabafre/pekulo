// packages/contracts/src/transactions/transactions.contract.ts
// Transactions module oRPC contract (stories 5-1 + 5-2). 7 procedures: 5
// single-row CRUD (5-1) + 2 bulk CSV (5-2: previewImportCsv, importCsv).
// Mount under /rpc/v1/transactions per ADR-0009.

import { oc } from "@orpc/contract";
import {
  createTransactionInputSchema,
  deleteTransactionInputSchema,
  getTransactionInputSchema,
  importCsvInputSchema,
  importCsvOutputSchema,
  listTransactionsInputSchema,
  listTransactionsOutputSchema,
  previewImportCsvInputSchema,
  previewImportCsvOutputSchema,
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
const invalidCsvError = {
  status: 400 as const,
  message: "csv invalid",
};
const payloadTooLargeError = {
  status: 413 as const,
  message: "csv too large",
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
  previewImportCsv: oc
    .errors({
      INVALID_CSV: invalidCsvError,
      PAYLOAD_TOO_LARGE: payloadTooLargeError,
    })
    .input(previewImportCsvInputSchema)
    .output(previewImportCsvOutputSchema),
  importCsv: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(importCsvInputSchema)
    .output(importCsvOutputSchema),
} as const;

export const transactionsContract = transactionsContractV1;
export const transactionsContractMeta = {
  moduleKey: "transactions",
  mountPath: "/rpc/v1/transactions",
  version: "v1",
} as const;
