import { createClient } from "@/lib/supabase/server"
import StatsCard from "@/components/ui/StatsCard"
import RevenueChart from "@/components/charts/RevenueChart"
import AttendanceChart from "@/components/charts/AttendanceChart"
import { Users, CreditCard, DollarSign, TrendingUp, BookOpen, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const [students, payments, expenses, dues, batches] = await Promise.all([
    supabase.from("students").select("id", { count: "exact" }).eq("is_active", true),
    supabase.from("payments").select("total_paid").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("expenses").select("amount").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("fee_dues").select("due_amount, paid_amount").eq("status", "pending"),
    supabase.from("batches").select("id").eq("is_active", true),
  ])
  const totalRevenue = (payments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0)
  const totalExpenses = (expenses.data || []).reduce((s, e) => s + (e.amount || 0), 0)
  const profit = totalRevenue - totalExpenses
  const totalDues = (dues.data || []).reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Analytics</h2><p className="text-sm text-gray-500 mt-1">Business insights and performance metrics</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard title="Active Students" value={students.count || 0} icon={Users} color="indigo" />
        <StatsCard title="Monthly Revenue" value={formatCurrency(totalRevenue)} icon={CreditCard} color="emerald" />
        <StatsCard title="Monthly Expenses" value={formatCurrency(totalExpenses)} icon={DollarSign} color="orange" />
        <StatsCard title="Net Profit" value={formatCurrency(profit)} icon={TrendingUp} color={profit >= 0 ? "emerald" : "red"} />
        <StatsCard title="Outstanding Dues" value={formatCurrency(totalDues)} icon={AlertCircle} color="red" />
        <StatsCard title="Active Batches" value={batches.data?.length || 0} icon={BookOpen} color="blue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <AttendanceChart />
      </div>
    </div>
  )
}
