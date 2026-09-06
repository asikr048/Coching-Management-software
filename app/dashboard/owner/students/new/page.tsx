import NewStudentForm from "./NewStudentForm"
import { createClient } from "@/lib/supabase/server"

export default async function NewStudentPage() {
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

  const [studentsRes, branchesRes, enrollmentsRes, paymentsRes, duesRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("branches")
      .select("id, name, address")
      .order("name"),
    supabase
      .from("enrollments")
      .select("id, created_at, status, batch_id, student_id, branch_id, student:students(id, name, student_id, phone, email, guardian_name, guardian_phone, address, school_college, class_level), batch:batches(id, name, subject, class_level, monthly_fee, admission_fee, classroom, branch_id)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("payments")
      .select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("fee_dues")
      .select("id, student_id, batch_id, due_amount, paid_amount, due_date, status")
      .limit(200),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enroll Student (নতুন শিক্ষার্থী ভর্তি)</h2>
        <p className="text-sm text-slate-500 mt-1">Select existing student or create new account, then enroll in a batch.</p>
      </div>
      <NewStudentForm 
        batches={batchesData} 
        students={studentsRes.data || []} 
        branches={branchesRes.data || []} 
        initialEnrollments={enrollmentsRes.data || []}
        initialPayments={paymentsRes.data || []}
        initialDues={duesRes.data || []}
      />
    </div>
  )
}
