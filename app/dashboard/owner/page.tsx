import { createClient } from "@/lib/supabase/server"
import StatsCard from "@/components/ui/StatsCard"
import RevenueChart from "@/components/charts/RevenueChart"
import AttendanceChart from "@/components/charts/AttendanceChart"
import FeeDueAlert from "@/components/modules/payments/FeeDueAlert"
import { Users, CreditCard, AlertCircle, TrendingUp, BookOpen, UserCheck } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

export default async function OwnerDashboard() {
  const supabase = await createClient()

  const [students, batches, payments, dues, todayAttendance, exams] = await Promise.all([
    supabase.from("students").select("id, is_active", { count: "exact" }),
    supabase.from("batches").select("id, name, current_seats, max_seats, is_active").eq("is_active", true),
    supabase.from("payments").select("total_paid, created_at").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("fee_dues").select("due_amount, paid_amount").eq("status", "pending"),
    supabase.from("attendance").select("id, status").eq("date", new Date().toISOString().split("T")[0]),
    supabase.from("exams").select("id").eq("is_published", false),
  ])

  const totalStudents = students.count || 0
  const activeStudents = students.data?.filter(s => s.is_active).length || 0
  const monthlyRevenue = (payments.data || []).reduce((sum, p) => sum + (p.total_paid || 0), 0)
  const totalDues = (dues.data || []).reduce((sum, d) => sum + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)
  const todayPresent = (todayAttendance.data || []).filter(a => a.status === "present").length
  const pendingExams = exams.data?.length || 0
  const activeBatches = batches.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Owner Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/owner/students/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            + New Student
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard title="Total Students" value={totalStudents} subtitle={`${activeStudents} active`} icon={Users} color="indigo" href="/dashboard/owner/students" />
        <StatsCard title="Active Batches" value={activeBatches.length} subtitle="Running classes" icon={BookOpen} color="blue" href="/dashboard/owner/batches" />
        <StatsCard title="Monthly Revenue" value={formatCurrency(monthlyRevenue)} subtitle="This month" icon={CreditCard} color="emerald" href="/dashboard/owner/analytics" />
        <StatsCard title="Pending Dues" value={formatCurrency(totalDues)} subtitle="Outstanding fees" icon={AlertCircle} color="red" href="/dashboard/owner/fee-dues" />
        <StatsCard title="Attendance" value={todayPresent} subtitle="View all attendance" icon={UserCheck} color="orange" href="/dashboard/owner/attendance" />
        <StatsCard title="Exams" value={pendingExams} subtitle="Manage exams" icon={TrendingUp} color="purple" href="/dashboard/owner/exams" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <AttendanceChart />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Batch Occupancy</h3>
          <Link href="/dashboard/owner/batches" className="text-sm text-indigo-600 hover:underline">View all</Link>
        </div>
        <div className="space-y-3">
          {activeBatches.slice(0, 6).map(batch => {
            const pct = Math.round((batch.current_seats / Math.max(batch.max_seats, 1)) * 100)
            return (
              <div key={batch.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{batch.name}</span>
                  <span className="text-gray-500">{batch.current_seats}/{batch.max_seats}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {activeBatches.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No active batches. <Link href="/dashboard/owner/batches" className="text-indigo-600 hover:underline">Create one</Link></p>
          )}
        </div>
      </div>

      <FeeDueAlert />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/dashboard/owner/students/new", label: "Add Student", icon: "👨‍🎓", bg: "from-indigo-500 to-violet-500", hover: "hover:shadow-indigo-200" },
            { href: "/dashboard/owner/payments", label: "Record Payment", icon: "💳", bg: "from-emerald-500 to-teal-500", hover: "hover:shadow-emerald-200" },
            { href: "/dashboard/owner/exams", label: "Create Exam", icon: "📝", bg: "from-blue-500 to-cyan-500", hover: "hover:shadow-blue-200" },
            { href: "/dashboard/owner/sms", label: "Send Bulk SMS", icon: "📱", bg: "from-orange-500 to-amber-500", hover: "hover:shadow-orange-200" },
            { href: "/dashboard/owner/batches", label: "New Batch", icon: "📚", bg: "from-purple-500 to-fuchsia-500", hover: "hover:shadow-purple-200" },
            { href: "/dashboard/owner/materials", label: "Materials", icon: "📦", bg: "from-rose-500 to-pink-500", hover: "hover:shadow-rose-200" },
            { href: "/dashboard/owner/referrals", label: "Referrals", icon: "🤝", bg: "from-sky-500 to-blue-500", hover: "hover:shadow-sky-200" },
            { href: "/dashboard/owner/analytics", label: "Analytics", icon: "📊", bg: "from-violet-500 to-purple-600", hover: "hover:shadow-violet-200" },
          ].map(action => (
            <Link key={action.href} href={action.href}
              className={`p-4 text-center rounded-xl bg-gradient-to-br ${action.bg} text-white font-semibold text-sm shadow-md ${action.hover} hover:shadow-lg hover:scale-[1.03] transition-all flex flex-col items-center gap-2`}>
              <span className="text-2xl">{action.icon}</span>
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
