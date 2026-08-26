import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate, getMonthLabel } from "@/lib/utils"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default async function FeeDuesPage() {
  const supabase = await createClient()
  const { data: dues } = await supabase.from("fee_dues").select("*, student:students(name, student_id, guardian_phone), batch:batches(name)").in("status", ["pending", "partial"]).order("due_date", { ascending: true })

  const totalDue = (dues || []).reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">Fee Dues</h2><p className="text-sm text-gray-500 mt-1">{dues?.length || 0} pending dues</p></div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2"><p className="text-xs text-red-500">Total Outstanding</p><p className="text-lg font-bold text-red-700">{formatCurrency(totalDue)}</p></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Outstanding</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {(!dues || dues.length === 0) ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No pending dues!</td></tr> :
              dues.map(d => {
                const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
                const overdue = new Date(d.due_date) < new Date()
                return (
                  <tr key={d.id} className={`hover:bg-gray-50 ${overdue ? "bg-red-50/50" : ""}`}>
                    <td className="px-4 py-3"><p className="text-sm font-medium text-gray-800">{d.student?.name}</p><p className="text-xs text-gray-400">{d.student?.student_id}</p></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.batch?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getMonthLabel(d.due_month)}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(d.due_amount)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">{formatCurrency(d.paid_amount || 0)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600">{formatCurrency(outstanding)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(d.due_date)}{overdue && <AlertCircle className="w-3 h-3 text-red-500 inline ml-1" />}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === "partial" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{d.status}</span></td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
