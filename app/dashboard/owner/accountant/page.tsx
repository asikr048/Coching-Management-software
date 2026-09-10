import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import AccountantClient from "./AccountantClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AccountantDeskPage() {
  const admin = createAdminClient()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: staff } = user
    ? await supabase.from("staff").select("id, name, email, role").eq("auth_user_id", user.id).maybeSingle()
    : { data: null }

  const [studentsRes, batchesRes, duesRes, paymentsRes, branchesRes] = await Promise.all([
    admin
      .from("students")
      .select("*, enrollments(id, batch_id, roll_no, status, created_at, batch:batches(id, name, monthly_fee, admission_fee, branch_id, class_level, fee_type))")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    admin
      .from("batches")
      .select("id, name, monthly_fee, admission_fee, branch_id, class_level, current_seats, max_seats, is_active, status, fee_type, branch:branches(id, name)")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    admin
      .from("fee_dues")
      .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(id, name, monthly_fee)")
      .order("due_date", { ascending: false }),

    admin
      .from("payments")
      .select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, notes, student:students(name, student_id), batch:batches(name)")
      .order("created_at", { ascending: false })
      .limit(300),

    admin
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ])

  // Fallback query if roll_no failed or if enrollments was empty
  let rawStudents = studentsRes.data || []
  if (rawStudents.length === 0) {
    const { data: fbStudents } = await supabase
      .from("students")
      .select("*, enrollments(id, batch_id, roll_no, status, created_at, batch:batches(id, name, monthly_fee, admission_fee, branch_id, class_level, fee_type))")
      .eq("is_active", true)
      .order("name", { ascending: true })
    if (fbStudents) rawStudents = fbStudents
  }

  // Calculate batch-wise sequential order for enrollments if roll_no is null
  const allEnrollmentsList: any[] = []
  rawStudents.forEach((st: any) => {
    (st.enrollments || []).forEach((enr: any) => {
      allEnrollmentsList.push({ ...enr, student_id: st.id })
    })
  })

  // Sort by created_at or id for deterministic batch rank
  allEnrollmentsList.sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0
    if (tA !== tB) return tA - tB
    return String(a.id || "").localeCompare(String(b.id || ""))
  })

  const batchCounters = new Map<string, number>()
  const enrRollMap = new Map<string, number>()
  allEnrollmentsList.forEach((e: any) => {
    const bId = e.batch_id || "default"
    const nextSeq = (batchCounters.get(bId) || 0) + 1
    batchCounters.set(bId, nextSeq)
    const assignedRoll = (e.roll_no != null && Number(e.roll_no) > 0) ? Number(e.roll_no) : nextSeq
    enrRollMap.set(e.id, assignedRoll)
  })

  const enrichedStudents = rawStudents.map((st: any) => ({
    ...st,
    enrollments: (st.enrollments || []).map((e: any) => ({
      ...e,
      roll_no: enrRollMap.get(e.id) ?? e.roll_no ?? st.roll_no ?? 1
    }))
  }))

  // Auto-heal any enrollments missing roll_no in database in background
  const nullRollEnrs = allEnrollmentsList.filter((e: any) => e.roll_no == null || Number(e.roll_no) <= 0)
  if (nullRollEnrs.length > 0) {
    (async () => {
      try {
        for (const e of nullRollEnrs) {
          const r = enrRollMap.get(e.id)
          if (r) {
            await admin.from("enrollments").update({ roll_no: r }).eq("id", e.id)
          }
        }
      } catch {}
    })()
  }

  const currentStaff = staff || {
    id: user?.id || "accountant",
    name: user?.user_metadata?.name || "Accountant",
    email: user?.email || "accountant@medhashiree.com",
    role: "accountant" as const,
  }

  return (
    <AccountantClient
      initialStudents={enrichedStudents}
      initialBatches={batchesRes.data || []}
      initialDues={duesRes.data || []}
      initialPayments={paymentsRes.data || []}
      branches={branchesRes.data || []}
      currentStaff={currentStaff}
    />
  )
}
