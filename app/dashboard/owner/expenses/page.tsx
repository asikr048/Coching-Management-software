import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: expenses } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false })
  const total = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Expenses</h2>
          <p className="text-sm text-slate-400 mt-1">Track operational expenditures & coaching overheads</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-2.5 backdrop-blur-md">
          <p className="text-xs text-amber-400/90 font-medium uppercase tracking-wider">Total Expenses</p>
          <p className="text-xl font-black text-amber-300">{formatCurrency(total)}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Category</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Description</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/70">
            {(!expenses || expenses.length === 0) ? (
              <tr><td colSpan={4} className="text-center py-14 text-slate-500 text-sm">No expenses recorded yet</td></tr>
            ) : (
              expenses.map(e => (
                <tr key={e.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800/80 text-amber-300 border border-slate-700/80 capitalize">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-300">{e.description || "—"}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-amber-400">{formatCurrency(e.amount)}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-400">{formatDate(e.expense_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
