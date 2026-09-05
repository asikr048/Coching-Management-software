import { createClient } from "@/lib/supabase/server"
import StatsCard from "@/components/ui/StatsCard"
import RevenueChart from "@/components/charts/RevenueChart"
import AttendanceChart from "@/components/charts/AttendanceChart"
import { Users, CreditCard, DollarSign, TrendingUp, BookOpen, AlertCircle, PieChart, BarChart3 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()

  const [students, thisMonthPayments, lastMonthPayments, yearPayments, expenses, dues, batches] = await Promise.all([
    supabase.from("students").select("id", { count: "exact" }).eq("is_active", true),
    supabase.from("payments").select("total_paid, payment_method").gte("created_at", thisMonthStart),
    supabase.from("payments").select("total_paid").gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd),
    supabase.from("payments").select("total_paid, created_at, payment_method, batch_id, batch:batches(name)").gte("created_at", yearStart),
    supabase.from("expenses").select("amount").gte("created_at", thisMonthStart),
    supabase.from("fee_dues").select("due_amount, paid_amount").eq("status", "pending"),
    supabase.from("batches").select("id, name").eq("is_active", true),
  ])

  const thisMonthRevenue = (thisMonthPayments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0)
  const lastMonthRevenue = (lastMonthPayments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0)
  const yearRevenue = (yearPayments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0)
  const totalExpenses = (expenses.data || []).reduce((s, e) => s + (e.amount || 0), 0)
  const profit = thisMonthRevenue - totalExpenses
  const totalDues = (dues.data || []).reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)
  const growth = lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0

  // Payment method breakdown
  const methodMap: Record<string, number> = {}
  for (const p of thisMonthPayments.data || []) {
    const method = p.payment_method || "unknown"
    methodMap[method] = (methodMap[method] || 0) + (p.total_paid || 0)
  }
  const methodBreakdown = Object.entries(methodMap).sort((a, b) => b[1] - a[1])

  // Monthly breakdown (last 6 months)
  const monthlyData: { month: string; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const monthName = d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    const rev = (yearPayments.data || []).filter(p => {
      const pd = new Date(p.created_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    }).reduce((s, p) => s + (p.total_paid || 0), 0)
    monthlyData.push({ month: monthName, revenue: rev })
  }

  // Top batches by revenue
  const batchRevMap: Record<string, { name: string; revenue: number }> = {}
  for (const p of yearPayments.data || []) {
    const batchId = p.batch_id || "unknown"
    const batchName = (p.batch as any)?.name || "Unassigned"
    if (!batchRevMap[batchId]) batchRevMap[batchId] = { name: batchName, revenue: 0 }
    batchRevMap[batchId].revenue += p.total_paid || 0
  }
  const topBatches = Object.values(batchRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const methodColors: Record<string, string> = {
    bkash: "bg-pink-500", nagad: "bg-orange-500", cash: "bg-emerald-500",
    card: "bg-blue-500", bank: "bg-indigo-500", online: "bg-purple-500", unknown: "bg-gray-400",
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Revenue & Analytics</h2>
        <p className="text-sm text-slate-400 mt-1">Institutional business intelligence and financial trajectory — Owner access only</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard title="This Month" value={formatCurrency(thisMonthRevenue)} subtitle="Revenue" icon={CreditCard} color="emerald"
          trend={growth !== 0 ? { value: growth, label: "vs last month" } : undefined} />
        <StatsCard title="Last Month" value={formatCurrency(lastMonthRevenue)} subtitle="Revenue" icon={CreditCard} color="blue" />
        <StatsCard title="Year Total" value={formatCurrency(yearRevenue)} subtitle={`${now.getFullYear()}`} icon={TrendingUp} color="indigo" />
        <StatsCard title="Monthly Expenses" value={formatCurrency(totalExpenses)} subtitle="This month" icon={DollarSign} color="orange" />
        <StatsCard title="Net Profit" value={formatCurrency(profit)} subtitle="This month" icon={TrendingUp} color={profit >= 0 ? "emerald" : "red"} />
        <StatsCard title="Outstanding Dues" value={formatCurrency(totalDues)} subtitle="Unpaid" icon={AlertCircle} color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <AttendanceChart />
      </div>

      {/* Monthly Breakdown + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Breakdown Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-900 text-base">Monthly Revenue (Last 6 Months)</h3>
          </div>
          <div className="space-y-3.5">
            {monthlyData.map((m, i) => {
              const maxRev = Math.max(...monthlyData.map(x => x.revenue), 1)
              const pct = Math.round((m.revenue / maxRev) * 100)
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-slate-300">{m.month}</span>
                    <span className="text-amber-300 font-bold">{formatCurrency(m.revenue)}</span>
                  </div>
                  <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-900 text-base">Payment Methods (This Month)</h3>
          </div>
          {methodBreakdown.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No payments this month</p>
          ) : (
            <div className="space-y-3.5">
              {methodBreakdown.map(([method, amount]) => {
                const pct = thisMonthRevenue > 0 ? Math.round((amount / thisMonthRevenue) * 100) : 0
                return (
                  <div key={method} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${methodColors[method] || "bg-slate-700"}`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-semibold text-slate-300 capitalize">{method}</span>
                        <span className="text-slate-400 font-mono text-xs">{formatCurrency(amount)} <span className="text-amber-400 font-bold">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-200">
                        <div className={`h-full rounded-full ${methodColors[method] || "bg-slate-700"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Batches by Revenue */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-slate-900 text-base">Top Batches by Revenue ({now.getFullYear()})</h3>
        </div>
        {topBatches.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No revenue data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3.5 text-left">#</th>
                  <th className="px-4 py-3.5 text-left">Batch</th>
                  <th className="px-4 py-3.5 text-left">Revenue</th>
                  <th className="px-4 py-3.5 text-left">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {topBatches.map((b, i) => {
                  const share = yearRevenue > 0 ? Math.round((b.revenue / yearRevenue) * 100) : 0
                  return (
                    <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3.5 text-sm text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-white">{b.name}</td>
                      <td className="px-4 py-3.5 text-sm font-extrabold text-amber-400">{formatCurrency(b.revenue)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-200">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs font-bold text-amber-300 font-mono">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
