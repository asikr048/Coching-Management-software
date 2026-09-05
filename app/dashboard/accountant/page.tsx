import { createClient } from "@/lib/supabase/server"
import StatsCard from "@/components/ui/StatsCard"
import { CreditCard, DollarSign, AlertCircle, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

export default async function AccountantDashboard() {
  const supabase = await createClient()
  const now = new Date()
  const [payments, expenses, dues] = await Promise.all([
    supabase.from("payments").select("total_paid").gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
    supabase.from("expenses").select("amount").gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
    supabase.from("fee_dues").select("due_amount, paid_amount").eq("status", "pending"),
  ])
  const rev = (payments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0)
  const exp = (expenses.data || []).reduce((s, e) => s + (e.amount || 0), 0)
  const totalDues = (dues.data || []).reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Accountant Dashboard</h2><p className="text-gray-500 text-sm mt-1">Financial overview</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Monthly Revenue" value={formatCurrency(rev)} icon={CreditCard} color="emerald" />
        <StatsCard title="Monthly Expenses" value={formatCurrency(exp)} icon={DollarSign} color="orange" />
        <StatsCard title="Net Profit" value={formatCurrency(rev - exp)} icon={TrendingUp} color={rev - exp >= 0 ? "emerald" : "red"} />
        <StatsCard title="Pending Dues" value={formatCurrency(totalDues)} icon={AlertCircle} color="red" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/dashboard/accountant/payments", label: "View Payments" },
          { href: "/dashboard/accountant/fee-dues", label: "Fee Dues" },
          { href: "/dashboard/accountant/expenses", label: "Expenses" },
          { href: "/dashboard/accountant/reports", label: "Reports" },
        ].map(a => (
          <Link key={a.href} href={a.href} className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all text-center text-sm font-medium text-gray-700 hover:text-indigo-700">{a.label}</Link>
        ))}
      </div>
    </div>
  )
}
