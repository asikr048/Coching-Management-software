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

  const [studentsRes, branchesRes, paymentsRes, duesRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college, roll_no, batch_roll")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("branches")
      .select("id, name, address")
      .order("name"),
    supabase
      .from("payments")
      .select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("fee_dues")
      .select("id, student_id, batch_id, due_amount, paid_amount, due_date, status")
      .limit(300),
  ])

  let rawEnrollments: any[] = []
  try {
    const { data: enr1, error: err1 } = await supabase
      .from("enrollments")
      .select("id, created_at, status, batch_id, student_id, branch_id")
      .order("created_at", { ascending: false })
      .limit(200)

    if (!err1 && enr1 && enr1.length > 0) {
      rawEnrollments = enr1
    } else {
      const { data: rawAll } = await supabase.from("enrollments").select("*").order("created_at", { ascending: false }).limit(200)
      if (rawAll) rawEnrollments = rawAll
    }
  } catch {
    try {
      const { data: rawAll } = await supabase.from("enrollments").select("*").order("created_at", { ascending: false }).limit(200)
      if (rawAll) rawEnrollments = rawAll
    } catch {}
  }

  const studentMap = new Map((studentsRes.data || []).map((s: any) => [s.id, s]))
  const batchMap = new Map((batchesData || []).map((b: any) => [b.id, b]))

  const enrichedEnrollments = rawEnrollments.map((e: any) => {
    const student = studentMap.get(e.student_id) || {}
    const batch = batchMap.get(e.batch_id) || {}
    return {
      ...e,
      roll_no: e.roll_no || (student as any).roll_no || (student as any).batch_roll || null,
      student,
      batch
    }
  })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5"><h2 className="text-2xl font-black text-white tracking-tight">New Enrollment</h2><p className="text-sm text-slate-400 mt-1">Register or enroll existing student in a batch.</p></div>
      <NewStudentForm 
        batches={batchesData} 
        students={studentsRes.data || []} 
        branches={branchesRes.data || []} 
        initialEnrollments={enrichedEnrollments}
        initialPayments={paymentsRes.data || []}
        initialDues={duesRes.data || []}
      />
    </div>
  )
}
