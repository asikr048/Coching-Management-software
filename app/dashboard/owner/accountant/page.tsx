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

  // 1. Fetch data with resilient queries and fallbacks
  const [studentsRes, batchesRes, enrollmentsRes, duesRes, paymentsRes, branchesRes] = await Promise.all([
    admin
      .from("students")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    admin
      .from("batches")
      .select("*")
      .order("created_at", { ascending: false }),

    admin
      .from("enrollments")
      .select("*"),

    admin
      .from("fee_dues")
      .select("*")
      .order("due_date", { ascending: false }),

    admin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),

    admin
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ])

  // Fallbacks if admin query returned empty
  let rawStudents = studentsRes.data || []
  if (rawStudents.length === 0) {
    const { data: fbStudents } = await supabase
      .from("students")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true })
    if (fbStudents) rawStudents = fbStudents
  }

  let rawBatches = batchesRes.data || []
  if (rawBatches.length === 0) {
    const { data: fbBatches } = await supabase
      .from("batches")
      .select("*")
      .order("created_at", { ascending: false })
    if (fbBatches) rawBatches = fbBatches
  }

  let rawEnrollments = enrollmentsRes.data || []
  if (rawEnrollments.length === 0) {
    const { data: fbEnr } = await supabase.from("enrollments").select("*")
    if (fbEnr) rawEnrollments = fbEnr
  }

  let rawDues = duesRes.data || []
  if (rawDues.length === 0) {
    const { data: fbDues } = await supabase.from("fee_dues").select("*").order("due_date", { ascending: false })
    if (fbDues) rawDues = fbDues
  }

  let rawPayments = paymentsRes.data || []
  if (rawPayments.length === 0) {
    const { data: fbPayments } = await supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(500)
    if (fbPayments) rawPayments = fbPayments
  }

  const rawBranches = branchesRes.data || []

  // 2. Determine active batches (any batch that is not finished and not explicitly inactive)
  const activeBatches = rawBatches.filter((b: any) => b.status !== "finished" && b.is_active !== false)
  const effectiveBatches = activeBatches.length > 0 ? activeBatches : rawBatches
  const activeBatchIdSet = new Set(effectiveBatches.map((b: any) => b.id))

  // Branch map for batches
  const branchMap = new Map<string, any>()
  rawBranches.forEach((br: any) => branchMap.set(br.id, br))

  const normalizedBatches = effectiveBatches.map((b: any) => ({
    ...b,
    is_active: b.status !== "finished" && b.is_active !== false,
    branch: b.branch || branchMap.get(b.branch_id) || null
  }))

  const batchMap = new Map<string, any>()
  normalizedBatches.forEach((b: any) => batchMap.set(b.id, b))

  const studentMap = new Map<string, any>()
  rawStudents.forEach((s: any) => {
    if (s.id) studentMap.set(String(s.id), s)
    if (s.student_id) studentMap.set(String(s.student_id), s)
  })

  // 3. AUTO-HEAL: Reconcile and auto-heal missing enrollments
  const enrolledStudentBatchSet = new Set<string>() // key: `${student_id}_${batch_id}`
  const activeEnrolledStudentIds = new Set<string>()

  rawEnrollments.forEach((e: any) => {
    if (e.student_id && e.batch_id) {
      enrolledStudentBatchSet.add(`${e.student_id}_${e.batch_id}`)
      if (e.status !== "inactive") {
        activeEnrolledStudentIds.add(String(e.student_id))
      }
    }
  })

  const newEnrollmentsToInsert: any[] = []

  // Source A: From fee_dues with batch_id
  rawDues.forEach((d: any) => {
    if (d.batch_id && d.student_id && !enrolledStudentBatchSet.has(`${d.student_id}_${d.batch_id}`)) {
      const b = batchMap.get(d.batch_id)
      const s = studentMap.get(String(d.student_id))
      if (b) {
        enrolledStudentBatchSet.add(`${d.student_id}_${d.batch_id}`)
        activeEnrolledStudentIds.add(String(d.student_id))
        const newEnr = {
          student_id: d.student_id,
          batch_id: d.batch_id,
          branch_id: b.branch_id || s?.branch_id || null,
          status: "active",
          roll_no: s?.roll_no || s?.batch_roll || 1,
          final_monthly_fee: Number(b.monthly_fee) || 0,
          enrollment_date: s?.enrollment_date || new Date().toISOString().split("T")[0]
        }
        newEnrollmentsToInsert.push(newEnr)
        rawEnrollments.push(newEnr)
      }
    }
  })

  // Source B: Un-enrolled active students matching batch class_level or branch
  const unEnrolledStudents = rawStudents.filter(
    (s: any) => s.is_active !== false && !activeEnrolledStudentIds.has(String(s.id))
  )
  if (unEnrolledStudents.length > 0 && normalizedBatches.length > 0) {
    unEnrolledStudents.forEach((s: any) => {
      let targetBatch = normalizedBatches.find(
        (b: any) => b.class_level && s.class_level && b.class_level.toLowerCase() === s.class_level.toLowerCase()
      )
      if (!targetBatch && normalizedBatches.length === 1) {
        targetBatch = normalizedBatches[0]
      }
      if (!targetBatch) {
        targetBatch = normalizedBatches.find((b: any) => b.branch_id && s.branch_id && b.branch_id === s.branch_id) || normalizedBatches[0]
      }

      if (targetBatch && !enrolledStudentBatchSet.has(`${s.id}_${targetBatch.id}`)) {
        enrolledStudentBatchSet.add(`${s.id}_${targetBatch.id}`)
        activeEnrolledStudentIds.add(String(s.id))
        const newEnr = {
          student_id: s.id,
          batch_id: targetBatch.id,
          branch_id: targetBatch.branch_id || s.branch_id || null,
          status: "active",
          roll_no: s.roll_no || s.batch_roll || 1,
          final_monthly_fee: Number(targetBatch.monthly_fee) || 0,
          enrollment_date: s.enrollment_date || new Date().toISOString().split("T")[0]
        }
        newEnrollmentsToInsert.push(newEnr)
        rawEnrollments.push(newEnr)
      }
    })
  }

  // Insert any healed enrollments in background
  if (newEnrollmentsToInsert.length > 0) {
    ;(async () => {
      try {
        await admin.from("enrollments").insert(newEnrollmentsToInsert)
      } catch (e) {
        console.warn("Auto-heal enrollments notice:", e)
      }
    })()
  }

  // 4. Calculate batch roll numbers deterministically
  const sortedEnrollments = [...rawEnrollments].sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0
    if (tA !== tB) return tA - tB
    return String(a.id || "").localeCompare(String(b.id || ""))
  })

  const batchCounters = new Map<string, number>()
  const enrRollMap = new Map<string, number>()
  sortedEnrollments.forEach((e: any) => {
    const bId = e.batch_id || "default"
    const nextSeq = (batchCounters.get(bId) || 0) + 1
    batchCounters.set(bId, nextSeq)
    const assignedRoll = (e.roll_no != null && Number(e.roll_no) > 0) ? Number(e.roll_no) : nextSeq
    enrRollMap.set(e.id || `${e.student_id}_${e.batch_id}`, assignedRoll)
  })

  // Group enrollments by student
  const enrollmentsByStudent = new Map<string, any[]>()
  sortedEnrollments.forEach((e: any) => {
    if (!e.student_id) return
    const b = batchMap.get(e.batch_id)
    if (!b) return
    const sObj = studentMap.get(String(e.student_id))
    const assignedRoll = enrRollMap.get(e.id || `${e.student_id}_${e.batch_id}`) ||
      (e.roll_no != null && Number(e.roll_no) > 0 ? Number(e.roll_no) : (sObj?.roll_no || 1))

    const item = {
      ...e,
      roll_no: assignedRoll,
      batch: b
    }

    const sKey = String(e.student_id)
    const list = enrollmentsByStudent.get(sKey) || []
    list.push(item)
    enrollmentsByStudent.set(sKey, list)

    if (sObj?.id && String(sObj.id) !== sKey) {
      const uList = enrollmentsByStudent.get(String(sObj.id)) || []
      uList.push(item)
      enrollmentsByStudent.set(String(sObj.id), uList)
    }
  })

  // 5. Enrich students with their batch enrollments
  const enrichedStudents = rawStudents.map((st: any) => {
    let sEnrs = enrollmentsByStudent.get(String(st.id)) || []
    if (sEnrs.length === 0 && st.student_id) {
      sEnrs = enrollmentsByStudent.get(String(st.student_id)) || []
    }

    // Deduplicate per batch
    const uniqueEnrs = Array.from(new Map(sEnrs.map((item: any) => [item.batch_id, item])).values())
    const firstRoll = uniqueEnrs.find((e: any) => e.roll_no != null)?.roll_no

    return {
      ...st,
      roll_no: firstRoll ?? st.roll_no ?? st.batch_roll ?? (uniqueEnrs.length > 0 ? 1 : null),
      batch_roll: firstRoll ?? st.batch_roll ?? st.roll_no ?? (uniqueEnrs.length > 0 ? 1 : null),
      enrollments: uniqueEnrs
    }
  })

  // 6. Enrich fee dues with batch object
  const enrichedDues = rawDues.map((d: any) => ({
    ...d,
    batch: d.batch || batchMap.get(d.batch_id) || null
  }))

  // 7. Enrich payments with student and batch objects
  const enrichedPayments = rawPayments
    .filter((p: any) => !p.batch_id || activeBatchIdSet.has(p.batch_id))
    .map((p: any) => ({
      ...p,
      student: p.student || studentMap.get(String(p.student_id)) || null,
      batch: p.batch || batchMap.get(p.batch_id) || null
    }))

  const currentStaff = staff || {
    id: user?.id || "accountant",
    name: user?.user_metadata?.name || "Accountant",
    email: user?.email || "accountant@medhashiree.com",
    role: "accountant" as const,
  }

  return (
    <AccountantClient
      initialStudents={enrichedStudents}
      initialBatches={normalizedBatches}
      initialDues={enrichedDues}
      initialPayments={enrichedPayments}
      branches={rawBranches}
      currentStaff={currentStaff}
    />
  )
}
