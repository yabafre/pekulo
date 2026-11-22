import {
  accountsContract,
  compassContract,
  holdingsContract,
  llmContract,
  milestonesContract,
  monthlyContract,
  realestateContract,
  settingsContract,
  transactionsContract,
} from "@pekulo/contracts";

import {
  accountDto,
  contractOutput,
  deleteAccountResult,
  holdingDto,
  lotDto,
  milestoneDto,
  monthlyRecordDto,
  mortgageDto,
  propertyDto,
  rentalDto,
  transactionDto,
} from "./helpers/contract-fixtures";

// The fixtures behind every mocked client must match the real output schemas,
// otherwise the "live data" tests would assert against shapes the API never returns.
describe("contract fixtures match the real @pekulo/contracts output schemas", () => {
  it("transactions", () => {
    contractOutput(transactionsContract, "createTransaction", transactionDto());
    contractOutput(transactionsContract, "updateTransaction", transactionDto());
    contractOutput(transactionsContract, "confirmCategorisation", transactionDto());
    contractOutput(transactionsContract, "deleteTransaction", { ok: true });
    contractOutput(transactionsContract, "listPendingSuggestions", {
      items: [transactionDto({ suggestedCategory: "courses", suggestedConfidence: 0.9 })],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it("milestones, accounts, holdings", () => {
    contractOutput(milestonesContract, "add", milestoneDto());
    contractOutput(milestonesContract, "delete", { id: milestoneDto().id });
    contractOutput(accountsContract, "create", accountDto());
    contractOutput(accountsContract, "update", accountDto());
    contractOutput(accountsContract, "recordBalanceChange", accountDto());
    contractOutput(accountsContract, "delete", { ok: true });
    contractOutput(holdingsContract, "create", holdingDto());
    contractOutput(holdingsContract, "recordLot", lotDto());
    contractOutput(holdingsContract, "close", { ok: true });
  });

  it("real estate, monthly, compass, AI opt-in, account deletion", () => {
    contractOutput(realestateContract, "createProperty", propertyDto());
    contractOutput(realestateContract, "recordValuation", propertyDto());
    contractOutput(realestateContract, "attachMortgage", mortgageDto());
    contractOutput(realestateContract, "updateMortgage", mortgageDto());
    contractOutput(realestateContract, "attachRental", rentalDto());
    contractOutput(realestateContract, "updateRental", rentalDto());
    contractOutput(realestateContract, "deleteProperty", { ok: true });
    contractOutput(monthlyContract, "signOffMonthly", monthlyRecordDto());
    contractOutput(monthlyContract, "reopenMonthly", monthlyRecordDto({ signedOffAt: null }));
    contractOutput(compassContract, "updateCompass", { objectif: 900000, horizonYears: 25 });
    contractOutput(llmContract, "setOptIn", { thirdParty: true });
    contractOutput(settingsContract, "deleteAccount", deleteAccountResult());
  });

  it("rejects a hand-written partial mock (the drift this guards against)", () => {
    expect(() => contractOutput(settingsContract, "deleteAccount", { ok: true })).toThrow(
      /does not match "deleteAccount"/,
    );
    expect(() => contractOutput(monthlyContract, "signOffMonthly", {})).toThrow(
      /does not match "signOffMonthly"/,
    );
  });
});
