// apps/api/src/modules/transactions/transactions.module.test.ts
// Whole-module smoke (story 5-1). Asserts the factory wires the chain.

import { describe, expect, mock, test } from "bun:test";
import { createTransactionsModule } from "./transactions.module";

describe("transactionsModule", () => {
  test("factory returns { service, router } with createTransaction wired", () => {
    const fakeClient = {
      transaction: {
        create: mock(),
        findFirst: mock(),
        findMany: mock(),
        updateMany: mock(),
        deleteMany: mock(),
      },
    };
    const mod = createTransactionsModule({
      prismaService: { client: fakeClient as unknown as never } as unknown as never,
      accountOwnershipProbe: { exists: mock(async () => true) },
      accountResolver: { resolve: mock(async () => ({ id: null, matchCount: 0 })) },
    });
    expect(mod.service).toBeDefined();
    expect(mod.router).toBeDefined();
    expect(typeof mod.service.createTransaction).toBe("function");
    expect(typeof mod.service.updateTransaction).toBe("function");
    expect(typeof mod.service.deleteTransaction).toBe("function");
    expect(typeof mod.service.getTransaction).toBe("function");
    expect(typeof mod.service.listTransactions).toBe("function");
    expect(typeof mod.service.previewImportCsv).toBe("function");
    expect(typeof mod.service.importCsv).toBe("function");
  });
});
