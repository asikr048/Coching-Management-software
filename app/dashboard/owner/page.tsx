import { createClient } from "@/lib/supabase/server"
import StatsCard from "@/components/ui/StatsCard"
import RevenueChart from "@/components/charts/RevenueChart"
import AttendanceChart from "@/components/charts/AttendanceChart"
import FeeDueAlert from "@/components/modules/payments/FeeDueAlert"
import { Users, CreditCard, AlertCircle, TrendingUp, BookOpen, UserCheck, Plus, Sparkles } from "lucide-react"
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
      {/* Top Banner Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#1e1b4b] via-indigo-950 to-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-indigo-900/60 shadow-lg relative overflow-hidden text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400" /> Executive Overview
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            Owner Dashboard (সার্বিক ড্যাশবোর্ড)
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            Welcome back! Real-time operations, financial metrics, and multi-branch pulse.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
          <Link
            href="/dashboard/owner/students/new"
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold rounded-xl text-sm transition-all shadow-md shadow-amber-500/25 hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>New Student (নতুন ভর্তি)</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
        <StatsCard title="Total Students" value={totalStudents} subtitle={`${activeStudents} active`} icon={Users} color="indigo" href="/dashboard/owner/students" />
        <StatsCard title="Active Batches" value={activeBatches.length} subtitle="Running classes" icon={BookOpen} color="blue" href="/dashboard/owner/batches" />
        <StatsCard title="Monthly Revenue" value={formatCurrency(monthlyRevenue)} subtitle="This month" icon={CreditCard} color="emerald" href="/dashboard/owner/analytics" />
        <StatsCard title="Pending Dues" value={formatCurrency(totalDues)} subtitle="Outstanding fees" icon={AlertCircle} color="red" href="/dashboard/owner/fee-dues" />
        <StatsCard title="Attendance" value={todayPresent} subtitle="View all attendance" icon={UserCheck} color="orange" href="/dashboard/owner/attendance" />
        <StatsCard title="Exams" value={pendingExams} subtitle="Manage exams" icon={TrendingUp} color="purple" href="/dashboard/owner/exams" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <AttendanceChart />
      </div>

      {/* Batch Occupancy Monitor */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">Batch Occupancy (ব্যাচ আসন সংখ্যা)</h3>
            <p className="text-xs text-slate-500 truncate">Current enrollment capacity per active batch</p>
          </div>
          <Link href="/dashboard/owner/batches" className="text-xs font-bold text-amber-700 hover:text-amber-800 shrink-0">
            View All Batches →
          </Link>
        </div>

        <div className="space-y-3">
          {activeBatches.slice(0, 6).map(batch => {
            const pct = Math.round((batch.current_seats / Math.max(batch.max_seats, 1)) * 100)
            return (
              <div key={batch.id} className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex justify-between text-xs sm:text-sm mb-1.5 gap-2">
                  <span className="font-bold text-slate-900 truncate">{batch.name}</span>
                  <span className="text-amber-800 font-mono font-bold shrink-0">
                    {batch.current_seats} / {batch.max_seats} ({pct}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 90
                        ? "bg-rose-500 shadow-xs"
                        : pct >= 70
                        ? "bg-amber-500 shadow-xs"
                        : "bg-emerald-500 shadow-xs"
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
          {activeBatches.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">
              No active batches. <Link href="/dashboard/owner/batches" className="text-amber-600 underline font-bold">Create your first batch</Link>
            </p>
          )}
        </div>
      </div>

      <FeeDueAlert />

      {/* Quick Actions Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-4">Quick Operations (দ্রুত অপশন)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {[
            { href: "/dashboard/owner/students/new", label: "Add Student", icon: "👨‍🎓", bg: "from-indigo-600 to-indigo-800", hover: "hover:border-indigo-400" },
            { href: "/dashboard/owner/branches", label: "Branches", icon: "🏛️", bg: "from-amber-600 to-amber-800", hover: "hover:border-amber-400" },
            { href: "/dashboard/owner/payments", label: "Record Payment", icon: "💳", bg: "from-emerald-600 to-emerald-800", hover: "hover:border-emerald-400" },
            { href: "/dashboard/owner/exams", label: "Create Exam", icon: "📝", bg: "from-sky-600 to-sky-800", hover: "hover:border-sky-400" },
            { href: "/dashboard/owner/sms", label: "Send Bulk SMS", icon: "📱", bg: "from-purple-600 to-purple-800", hover: "hover:border-purple-400" },
            { href: "/dashboard/owner/batches", label: "New Batch", icon: "📚", bg: "from-rose-600 to-rose-800", hover: "hover:border-rose-400" },
            { href: "/dashboard/owner/staff", label: "Manage Staff", icon: "👥", bg: "from-teal-600 to-teal-800", hover: "hover:border-teal-400" },
            { href: "/dashboard/owner/slider", label: "Homepage Editor", icon: "🌐", bg: "from-amber-500 to-amber-700", hover: "hover:border-amber-300" },
          ].map(action => (
            <Link
              key={action.href}
              href={action.href}
              className={`p-3 sm:p-4 text-center rounded-2xl bg-gradient-to-br ${action.bg} text-white font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] flex flex-col items-center justify-center gap-1.5 sm:gap-2 border border-white/10`}
            >
              <span className="text-xl sm:text-2xl drop-shadow-sm">{action.icon}</span>
              <span className="truncate w-full">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
