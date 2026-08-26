import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: expenses } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false })
  const total = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">Expenses</h2><p className="text-sm text-gray-500 mt-1">Track center expenses</p></div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2"><p className="text-xs text-orange-500">Total Expenses</p><p className="text-lg font-bold text-orange-700">{formatCurrency(total)}</p></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {(!expenses || expenses.length === 0) ? <tr><td colSpan={4} className="text-center py-12 text-gray-400">No expenses recorded</td></tr> :
              expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">{e.category}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{e.description || "-"}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-orange-700">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(e.expense_date)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
