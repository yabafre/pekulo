import type { Account, Holding, PortfolioSnapshot } from "./types";

export function computeSnapshot(accounts: Account[], holdings: Holding[]): PortfolioSnapshot {
  const cash = accounts.reduce((acc, a) => acc + a.cashBalance, 0);
  const invested = holdings.reduce((acc, h) => acc + h.quantity * h.avgCost, 0);
  const marketValue = holdings.reduce((acc, h) => acc + h.quantity * h.lastPrice, 0);
  const capitalTotal = cash + marketValue;
  const pnl = marketValue - invested;

  const byAccount = accounts.map((a) => {
    const holdingValue = holdings
      .filter((h) => h.accountId === a.id)
      .reduce((sum, h) => sum + h.quantity * h.lastPrice, 0);
    return {
      accountId: a.id,
      label: a.label,
      total: a.cashBalance + holdingValue,
    };
  });

  return {
    accounts,
    holdings,
    kpi: { capitalTotal, cash, invested, marketValue, pnl },
    byAccount,
  };
}
