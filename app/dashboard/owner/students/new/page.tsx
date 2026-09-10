import NewStudentForm from "./NewStudentForm"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function NewStudentPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  let batchesData: any[] = []
  try {
    const { data: fullList, error: fullErr } = await admin
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

  // 1. Fetch Students (all students to map history reliably)
  let studentsList: any[] = []
  try {
    const { data: stData, error: stErr } = await admin
      .from("students")
      .select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college, roll_no, batch_roll, is_active")
      .order("name")

    if (!stErr && stData && stData.length > 0) {
      studentsList = stData
    } else {
      const { data: fallbackStudents } = await supabase
        .from("students")
        .select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college, roll_no, batch_roll, is_active")
        .order("name")
      if (fallbackStudents) studentsList = fallbackStudents
    }
  } catch {
    try {
      const { data: fallbackStudents } = await supabase
        .from("students")
        .select("*")
        .order("name")
      if (fallbackStudents) studentsList = fallbackStudents
    } catch {}
  }

  // 2. Fetch Branches, Payments, Dues in parallel
  const [branchesRes, paymentsRes, duesRes] = await Promise.all([
    admin.from("branches").select("id, name, address").order("name"),
    admin.from("payments").select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, paid_at").order("created_at", { ascending: false }).limit(300),
    admin.from("fee_dues").select("id, student_id, batch_id, due_amount, paid_amount, due_date, status").limit(300),
  ])

  // 3. Fetch Enrollments with schema-safe decoupled queries
  let rawEnrollments: any[] = []
  try {
    const { data: enr1, error: err1 } = await admin
      .from("enrollments")
      .select("id, created_at, status, batch_id, student_id, branch_id, roll_no")
      .order("created_at", { ascending: false })
      .limit(200)

    if (!err1 && enr1 && enr1.length > 0) {
      rawEnrollments = enr1
    } else {
      const { data: fbEnr } = await supabase
        .from("enrollments")
        .select("id, created_at, status, batch_id, student_id, branch_id, roll_no")
        .order("created_at", { ascending: false })
        .limit(200)
      if (fbEnr && fbEnr.length > 0) {
        rawEnrollments = fbEnr
      } else {
        const { data: rawAll } = await admin.from("enrollments").select("*").order("created_at", { ascending: false }).limit(200)
        if (rawAll) rawEnrollments = rawAll
      }
    }
  } catch {
    try {
      const { data: rawAll } = await supabase.from("enrollments").select("*").order("created_at", { ascending: false }).limit(200)
      if (rawAll) rawEnrollments = rawAll
    } catch {}
  }

  // 4. Enrich Enrollments with Student and Batch metadata
  const studentMap = new Map<string, any>()
  ;(studentsList || []).forEach((s: any) => {
    if (s.id) studentMap.set(String(s.id), s)
    if (s.student_id) studentMap.set(String(s.student_id), s)
  })
  const batchMap = new Map((batchesData || []).map((b: any) => [b.id, b]))

  const enrichedEnrollments = rawEnrollments.map((e: any) => {
    const student = (e.student_id ? studentMap.get(String(e.student_id)) : null) || {}
    const batch = (e.batch_id ? batchMap.get(String(e.batch_id)) : null) || {}
    return {
      ...e,
      roll_no: e.roll_no || student.roll_no || student.batch_roll || null,
      student,
      batch
    }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enroll Student (নতুন শিক্ষার্থী ভর্তি)</h2>
        <p className="text-sm text-slate-500 mt-1">Select existing student or create new account, then enroll in a batch.</p>
      </div>
      <NewStudentForm 
        batches={batchesData} 
        students={studentsList} 
        branches={branchesRes.data || []} 
        initialEnrollments={enrichedEnrollments}
        initialPayments={paymentsRes.data || []}
        initialDues={duesRes.data || []}
      />
    </div>
  )
}
