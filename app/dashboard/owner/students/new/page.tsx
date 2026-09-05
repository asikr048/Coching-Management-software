import NewStudentForm from "./NewStudentForm"
import { createClient } from "@/lib/supabase/server"

export default async function NewStudentPage() {
  const supabase = await createClient()
  const [batchesRes, studentsRes] = await Promise.all([
    supabase.from("batches").select("id, name, subject, class_level, max_seats, current_seats, monthly_fee, admission_fee, status").eq("is_active", true),
    supabase.from("students").select("id, name, student_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college").eq("is_active", true),
  ])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h2 className="text-2xl font-black text-white tracking-tight">Enroll Student</h2>
        <p className="text-sm text-slate-400 mt-1">Select existing student or create new account, then enroll in a batch.</p>
      </div>
      <NewStudentForm batches={batchesRes.data || []} students={studentsRes.data || []} />
    </div>
  )
}
