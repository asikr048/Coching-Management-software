import { createClient } from "@/lib/supabase/server"
import StatsCard from "@/components/ui/StatsCard"
import { BookOpen, Users, FileText, ShoppingBag } from "lucide-react"
import Link from "next/link"

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staff } = await supabase.from("staff").select("id").eq("auth_user_id", user?.id).single()
  const teacherId = staff?.id

  const [batches, exams, courses] = await Promise.all([
    supabase.from("batches").select("id, name, current_seats").eq("teacher_id", teacherId).eq("is_active", true),
    supabase.from("exams").select("id").eq("created_by", teacherId),
    supabase.from("courses").select("id, total_sales").eq("teacher_id", teacherId),
  ])
  const totalStudents = (batches.data || []).reduce((s, b) => s + (b.current_seats || 0), 0)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h2><p className="text-gray-500 text-sm mt-1">Manage your batches and courses.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="My Batches" value={batches.data?.length || 0} icon={BookOpen} color="blue" />
        <StatsCard title="Total Students" value={totalStudents} icon={Users} color="indigo" />
        <StatsCard title="Exams Created" value={exams.data?.length || 0} icon={FileText} color="purple" />
        <StatsCard title="Course Sales" value={(courses.data || []).reduce((s, c) => s + (c.total_sales || 0), 0)} icon={ShoppingBag} color="emerald" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/dashboard/teacher/attendance", label: "Mark Attendance" },
          { href: "/dashboard/teacher/exams", label: "Create Exam" },
          { href: "/dashboard/teacher/results", label: "Enter Results" },
          { href: "/dashboard/teacher/courses", label: "My Courses" },
        ].map(a => (
          <Link key={a.href} href={a.href} className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all text-center text-sm font-medium text-gray-700 hover:text-indigo-700">{a.label}</Link>
        ))}
      </div>
    </div>
  )
}
