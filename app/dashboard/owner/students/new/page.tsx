import NewStudentForm from "./NewStudentForm"
import { createClient } from "@/lib/supabase/server"

export default async function NewStudentPage() {
  const supabase = await createClient()
  const [batchesRes, studentsRes, branchesRes] = await Promise.all([
    supabase.from("batches").select("id, name, branch_id, classroom, subject, class_level, max_seats, current_seats, monthly_fee, admission_fee, status").eq("is_active", true),
    supabase.from("students").select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college").eq("is_active", true),
    supabase.from("branches").select("id, name").order("name"),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enroll Student (নতুন শিক্ষার্থী ভর্তি)</h2>
        <p className="text-sm text-slate-500 mt-1">Select existing student or create new account, then enroll in a batch.</p>
      </div>
      <NewStudentForm batches={batchesRes.data || []} students={studentsRes.data || []} branches={branchesRes.data || []} />
    </div>
  )
}
