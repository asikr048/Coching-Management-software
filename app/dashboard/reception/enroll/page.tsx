import NewStudentForm from "../../owner/students/new/NewStudentForm"
import { createClient } from "@/lib/supabase/server"

export default async function ReceptionEnrollPage() {
  const supabase = await createClient()

  let batchesData: any[] = []
  try {
    const { data: fullList, error: fullErr } = await supabase
      .from("batches")
      .select("id, name, branch_id, origin_batch_id, origin_branch_id, branch_seats, classroom, subject, class_level, max_seats, current_seats, monthly_fee, admission_fee, status, is_active")
      .order("name")

    if (!fullErr && fullList && fullList.length > 0) {
      batchesData = fullList.filter((b: any) => b.is_active !== false && b.status !== "finished")
    }
  } catch {}

  if (batchesData.length === 0) {
    try {
      const { data: rawList } = await supabase
        .from("batches")
        .select("*")
        .order("name")
      if (rawList && rawList.length > 0) {
        batchesData = rawList.filter((b: any) => b.is_active !== false && b.status !== "finished")
      }
    } catch {}
  }

  const [studentsRes, branchesRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("branches")
      .select("id, name, address")
      .order("name"),
  ])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5"><h2 className="text-2xl font-black text-white tracking-tight">New Enrollment</h2><p className="text-sm text-slate-400 mt-1">Register or enroll existing student in a batch.</p></div>
      <NewStudentForm batches={batchesData} students={studentsRes.data || []} branches={branchesRes.data || []} />
    </div>
  )
}
