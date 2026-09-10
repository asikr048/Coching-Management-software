import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import StudentsClient from "../../owner/students/StudentsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ReceptionStudentsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [studentsRes, batchesRes] = await Promise.all([
    admin.from("students").select("*, enrollments(batch_id, status, roll_no, batch:batches(name))").order("created_at", { ascending: false }),
    admin.from("batches").select("id, name").eq("is_active", true)
  ])

  let students = studentsRes.data || []
  if (students.length === 0) {
    const { data: fallbackStudents } = await supabase.from("students").select("*, enrollments(batch_id, status, roll_no, batch:batches(name))").order("created_at", { ascending: false })
    if (fallbackStudents && fallbackStudents.length > 0) {
      students = fallbackStudents
    }
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">Students</h2><p className="text-sm text-slate-500 mt-1">{students?.length || 0} total students</p></div>
      <StudentsClient students={students || []} batches={batchesRes.data || []} />
    </div>
  )
}
