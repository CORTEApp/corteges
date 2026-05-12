import Link from "next/link"
import { CreditCard, FileText, Plus, ReceiptText, WalletCards } from "lucide-react"

import {
  ExpenseIndividualFiltersBar,
  ExpenseIndividualsTable,
} from "@/app/(app)/gastos/individuales/_components/expense-list"
import { ResourceListScreen } from "@/components/resource-screens"
import { Button } from "@/components/ui/button"
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card"
import {
  formatExpenseAmountCompact,
  toExpenseNumber,
} from "@/lib/expenses/format"
import { listExpenseIndividuals } from "@/lib/expenses/data"
import type { ExpenseIndividualFilters } from "@/lib/expenses/types"

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ExpenseIndividualsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const filters: ExpenseIndividualFilters = {
    q: one(params.q),
    supplier: one(params.supplier) ?? "all",
    payment: one(params.payment) ?? "all",
    year: one(params.year) ?? String(new Date().getFullYear()),
    month: one(params.month) ?? "all",
  }
  const { expenses, suppliers } = await listExpenseIndividuals(filters)
  const netTotal = expenses.reduce((sum, expense) => sum + toExpenseNumber(expense.net_amount), 0)
  const total = expenses.reduce((sum, expense) => sum + toExpenseNumber(expense.total_amount), 0)
  const n26Count = expenses.filter((expense) => expense.payment_method === "n26").length
  const caixaCount = expenses.filter((expense) => expense.payment_method === "caixa").length
  const documentCount = expenses.filter((expense) => expense.document_count > 0 || expense.legacy_has_attachment).length

  return (
    <ResourceListScreen
      header={{
        icon: <ReceiptText className="size-6" aria-hidden="true" />,
        title: "Gastos individuales",
        subtitle: "Gastos puntuales con proveedor obligatorio, factura, importes y soporte documental.",
        actions: (
          <Button asChild>
            <Link href="/gastos/individuales/nuevo">
              <Plus aria-hidden="true" />
              Nuevo gasto
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Gastos", value: String(expenses.length), description: "Resultado del filtro actual", icon: <ReceiptText className="size-4" aria-hidden="true" /> },
        { label: "Total", value: formatExpenseAmountCompact(total), tone: "success", icon: <WalletCards className="size-4" aria-hidden="true" /> },
        { label: "Base", value: formatExpenseAmountCompact(netTotal), icon: <CreditCard className="size-4" aria-hidden="true" /> },
        { label: "N26 / Caixa", value: `${n26Count} / ${caixaCount}`, description: "Metodos visibles", icon: <FileText className="size-4" aria-hidden="true" /> },
        { label: "Docs", value: String(documentCount), description: "Locales o flag historico" },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <ExpenseIndividualFiltersBar filters={filters} suppliers={suppliers} />
        <div className="space-y-6">
          <ExpenseIndividualsTable expenses={expenses} />
        </div>
      </div>
    </ResourceListScreen>
  )
}
