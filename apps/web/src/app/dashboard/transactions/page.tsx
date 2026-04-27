import { readTransactions } from "@/lib/data/transactions"
import { TransactionsList } from "./_components/transactions-list"

export const dynamic = "force-dynamic"

export default async function TransactionsPage() {
  const now = new Date()
  const year = now.getFullYear()
  const monthNum = now.getMonth() + 1
  const initial = await readTransactions({ year, monthNum, limit: 100 })

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toutes tes entrées et sorties, mois par mois. Coche « imprévu » pour les évènements ponctuels.
        </p>
      </div>
      <TransactionsList
        initialData={initial}
        defaultYear={year}
        defaultMonth={monthNum}
      />
    </div>
  )
}
