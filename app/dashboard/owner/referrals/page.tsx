import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"
import { GitMerge } from "lucide-react"

export default async function ReferralsPage() {
  const supabase = await createClient()
  const { data: referrals } = await supabase.from("referrals").select("*, referrer:students!referrals_referrer_id_fkey(name, student_id, referral_code), referee:students!referrals_referee_id_fkey(name, student_id)").order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Referral System</h2><p className="text-sm text-gray-500 mt-1">Track student referrals and commissions</p></div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Referrer</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Referred Student</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission Rate</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {(!referrals || referrals.length === 0) ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">No referrals yet</td></tr> :
              referrals.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><GitMerge className="w-4 h-4 text-indigo-500" /><div><p className="text-sm font-medium text-gray-800">{r.referrer?.name}</p><p className="text-xs text-gray-400">{r.referrer?.referral_code}</p></div></div></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.referee?.name}<br/><span className="text-xs text-gray-400">{r.referee?.student_id}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.commission_rate}%</td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{formatCurrency(r.commission_amount || 0)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "paid" ? "bg-emerald-100 text-emerald-700" : r.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.created_at)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
