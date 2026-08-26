import { createClient } from "@/lib/supabase/server"
import StatsCard from "@/components/ui/StatsCard"
import { Users, UserCheck, CreditCard, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

export default async function ReceptionDashboard() {
  const supabase = await createClient()
  const [students, todayAtt, recentPayments, dues] = await Promise.all([
    supabase.from("students").select("id", { count: "exact" }).eq("is_active", true),
    supabase.from("attendance").select("id, status").eq("date", new Date().toISOString().split("T")[0]),
    supabase.from("payments").select("total_paid, student:students(name), receipt_number, paid_at").order("paid_at", { ascending: false }).limit(5),
    supabase.from("fee_dues").select("due_amount, paid_amount").eq("status", "pending"),
  ])
  const todayPresent = (todayAtt.data || []).filter(a => a.status === "present").length
  const totalDues = (dues.data || []).reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Reception Dashboard</h2><p className="text-gray-500 text-sm mt-1">Welcome! Manage daily operations.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Active Students" value={students.count || 0} icon={Users} color="indigo" />
        <StatsCard title="Today Present" value={todayPresent} icon={UserCheck} color="emerald" />
        <StatsCard title="Recent Collection" value={formatCurrency((recentPayments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0))} icon={CreditCard} color="blue" />
        <StatsCard title="Pending Dues" value={formatCurrency(totalDues)} icon={AlertCircle} color="red" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { href: "/dashboard/reception/enroll", label: "New Enrollment", color: "indigo" },
          { href: "/dashboard/reception/payments", label: "Collect Fee", color: "emerald" },
          { href: "/dashboard/reception/attendance", label: "Mark Attendance", color: "blue" },
          { href: "/dashboard/reception/biometric", label: "Biometric Entry", color: "purple" },
          { href: "/dashboard/reception/students", label: "View Students", color: "orange" },
        ].map(a => (
          <Link key={a.href} href={a.href} className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all text-center text-sm font-medium text-gray-700 hover:text-indigo-700">{a.label}</Link>
        ))}
      </div>
    </div>
  )
}
