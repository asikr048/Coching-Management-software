import { createClient } from "@/lib/supabase/server"
import StudentsClient from "../../owner/students/StudentsClient"

export default async function ReceptionStudentsPage() {
  const supabase = await createClient()
  const { data: students } = await supabase.from("students").select("*, enrollments(batch_id, status, batch:batches(name))").order("created_at", { ascending: false })
  const { data: batches } = await supabase.from("batches").select("id, name").eq("is_active", true)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-white tracking-tight">Students</h2><p className="text-sm text-slate-400 mt-1">{students?.length || 0} total students</p></div>
      <StudentsClient students={students || []} batches={batches || []} />
    </div>
  )
}
