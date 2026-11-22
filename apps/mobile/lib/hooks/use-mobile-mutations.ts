// apps/mobile/lib/hooks/use-mobile-mutations.ts
// Write-side React Query hooks for apps/mobile (ADR-0010: screens never call
// oRPC clients directly). Every hook validates its input with the same
// `@pekulo/validators` schema the web server actions use, calls the matching
// `@pekulo/contracts` procedure, then refreshes the affected screens. In
// unauthenticated preview mode they throw `PreviewModeError` without any
// remote call so the UI can offer a sign-in prompt instead.

import {
  addMilestoneInputSchema,
  attachMortgageInputSchema,
  attachRentalInputSchema,
  closeHoldingInputSchema,
  confirmCategorisationInputSchema,
  createAccountInputSchema,
  createHoldingInputSchema,
  createPropertyInputSchema,
  createTransactionInputSchema,
  deleteAccountInputSchema,
  deleteMilestoneInputSchema,
  deletePropertyInputSchema,
  deleteTransactionInputSchema,
  deleteUserAccountInputSchema,
  recordBalanceChangeInputSchema,
  recordLotInputSchema,
  recordValuationInputSchema,
  reopenMonthlyInputSchema,
  signOffMonthlyInputSchema,
  updateAccountInputSchema,
  updateCompassInputSchema,
  updateLlmOptInSchema,
  updateMortgageInputSchema,
  updateRentalInputSchema,
  updateTransactionInputSchema,
} from "@pekulo/validators";
import type { z } from "@pekulo/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import { validateInput } from "../forms";
import {
  accountsClient,
  compassClient,
  holdingsClient,
  llmClient,
  milestonesClient,
  monthlyClient,
  realestateClient,
  settingsClient,
  transactionsClient,
} from "../orpc/modules";
import { tNow } from "../i18n";
import { orpcErrorCode } from "../orpc/errors";
import { mobileQueryKeys } from "./use-mobile-queries";

export class PreviewModeError extends Error {
  constructor() {
    super(tNow("common.errors.previewMessage"));
    this.name = "PreviewModeError";
  }
}

type ScreenKey = keyof typeof mobileQueryKeys;

/**
 * One guarded, validated mutation: preview guard → schema parse → contract
 * call → invalidate every listed screen so it re-renders with fresh data.
 */
function useContractMutation<S extends z.ZodType, TResult>(
  schema: S,
  call: (input: z.output<S>) => Promise<TResult>,
  refresh: ScreenKey[],
) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, z.input<S>>({
    mutationFn: async (input) => {
      if (!isAuthenticated) throw new PreviewModeError();
      return await call(validateInput(schema, input));
    },
    onSuccess: async () => {
      await Promise.all(
        refresh.map((key) => queryClient.invalidateQueries({ queryKey: mobileQueryKeys[key]() })),
      );
    },
  });
}

export function useTransactionMutations() {
  const refresh: ScreenKey[] = ["transactions", "cap", "monthly"];
  return {
    create: useContractMutation(
      createTransactionInputSchema,
      (i) => transactionsClient.createTransaction(i),
      refresh,
    ),
    update: useContractMutation(
      updateTransactionInputSchema,
      (i) => transactionsClient.updateTransaction(i),
      refresh,
    ),
    remove: useContractMutation(
      deleteTransactionInputSchema,
      (i) => transactionsClient.deleteTransaction(i),
      refresh,
    ),
    confirmCategory: useContractMutation(
      confirmCategorisationInputSchema,
      (i) => transactionsClient.confirmCategorisation(i),
      refresh,
    ),
  };
}

export function useMilestoneMutations() {
  const refresh: ScreenKey[] = ["cap"];
  return {
    add: useContractMutation(addMilestoneInputSchema, (i) => milestonesClient.add(i), refresh),
    remove: useContractMutation(
      deleteMilestoneInputSchema,
      (i) => milestonesClient.delete(i),
      refresh,
    ),
  };
}

export function useAccountMutations() {
  const refresh: ScreenKey[] = ["cap", "transactions", "portfolio"];
  return {
    create: useContractMutation(createAccountInputSchema, (i) => accountsClient.create(i), refresh),
    update: useContractMutation(updateAccountInputSchema, (i) => accountsClient.update(i), refresh),
    recordBalance: useContractMutation(
      recordBalanceChangeInputSchema,
      (i) => accountsClient.recordBalanceChange(i),
      refresh,
    ),
    remove: useContractMutation(deleteAccountInputSchema, (i) => accountsClient.delete(i), refresh),
  };
}

export function useHoldingMutations() {
  const refresh: ScreenKey[] = ["portfolio", "cap"];
  return {
    create: useContractMutation(createHoldingInputSchema, (i) => holdingsClient.create(i), refresh),
    recordLot: useContractMutation(
      recordLotInputSchema,
      (i) => holdingsClient.recordLot(i),
      refresh,
    ),
    close: useContractMutation(closeHoldingInputSchema, (i) => holdingsClient.close(i), refresh),
  };
}

export function useRealEstateMutations() {
  const refresh: ScreenKey[] = ["realestate", "cap", "property", "valuations"];
  return {
    createProperty: useContractMutation(
      createPropertyInputSchema,
      (i) => realestateClient.createProperty(i),
      refresh,
    ),
    recordValuation: useContractMutation(
      recordValuationInputSchema,
      (i) => realestateClient.recordValuation(i),
      refresh,
    ),
    attachMortgage: useContractMutation(
      attachMortgageInputSchema,
      (i) => realestateClient.attachMortgage(i),
      refresh,
    ),
    updateMortgage: useContractMutation(
      updateMortgageInputSchema,
      (i) => realestateClient.updateMortgage(i),
      refresh,
    ),
    attachRental: useContractMutation(
      attachRentalInputSchema,
      (i) => realestateClient.attachRental(i),
      refresh,
    ),
    updateRental: useContractMutation(
      updateRentalInputSchema,
      (i) => realestateClient.updateRental(i),
      refresh,
    ),
    deleteProperty: useContractMutation(
      deletePropertyInputSchema,
      (i) => realestateClient.deleteProperty(i),
      refresh,
    ),
  };
}

export function useMonthlyMutations() {
  const refresh: ScreenKey[] = ["monthly", "transactions"];
  return {
    signOff: useContractMutation(
      signOffMonthlyInputSchema,
      (i) => monthlyClient.signOffMonthly(i),
      refresh,
    ),
    reopen: useContractMutation(
      reopenMonthlyInputSchema,
      (i) => monthlyClient.reopenMonthly(i),
      refresh,
    ),
  };
}

export function useCompassMutation() {
  return useContractMutation(updateCompassInputSchema, (i) => compassClient.updateCompass(i), [
    "cap",
    "compass",
  ]);
}

export function useLlmOptIn() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = [...mobileQueryKeys.llm(), isAuthenticated];
  const query = useQuery({
    queryKey,
    queryFn: async () => (isAuthenticated ? await llmClient.getOptIn() : { thirdParty: false }),
  });
  const mutation = useMutation({
    mutationFn: async (thirdParty: boolean) => {
      if (!isAuthenticated) throw new PreviewModeError();
      return await llmClient.setOptIn(validateInput(updateLlmOptInSchema, { thirdParty }));
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
    },
  });
  return {
    thirdParty: query.data?.thirdParty ?? false,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    setThirdParty: mutation.mutateAsync,
  };
}

export function useDeleteUserAccount() {
  const { isAuthenticated, signOut } = useAuth();
  return useMutation({
    mutationFn: async (input: { confirmationEmail: string }) => {
      if (!isAuthenticated) throw new PreviewModeError();
      const payload = validateInput(deleteUserAccountInputSchema, input);
      let result;
      try {
        result = await settingsClient.deleteAccount(payload);
      } catch (error) {
        // The data is erased but the auth identity survived: this session now
        // points at an empty account, so end it instead of leaving the user in it.
        if (orpcErrorCode(error) === "ACCOUNT_PARTIALLY_ERASED") await signOut();
        throw error;
      }
      await signOut();
      return result;
    },
  });
}
