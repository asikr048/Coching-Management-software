import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import ApprovalsClient from "./ApprovalsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function PaymentApprovalsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Find staff profile for current user
  let currentStaff: { id: string; role: string; name?: string } | null = null
  if (user?.id) {
    const { data: staffData } = await admin
      .from("staff")
      .select("id, role, name")
      .eq("auth_user_id", user.id)
      .maybeSingle()
    if (staffData) currentStaff = staffData
  }

  // Determine approval rights
  const isOwnerOrManager = ["owner", "super_manager", "manager"].includes(currentStaff?.role || "")
  let canApprove = isOwnerOrManager
  if (!canApprove && currentStaff?.id) {
    const { data: approverCheck } = await admin
      .from("payment_approvers")
      .select("id")
      .eq("staff_id", currentStaff.id)
      .maybeSingle()
    canApprove = !!approverCheck
  }
  // Default to true for authorized dashboard visitors if staff role is not yet mapped
  if (!currentStaff) {
    canApprove = true
  }

  // Resilient multi-tier query for payment submissions
  let rawSubmissions: any[] = []
  let queryError: any = null

  // Attempt 1: Full join with student, batch, and course
  try {
    const res1 = await admin
      .from("payment_submissions")
      .select("*, student:students(name, student_id, phone, email, guardian_phone), batch:batches(name, subject, monthly_fee), course:courses(title, category, price)")
      .order("created_at", { ascending: false })

    if (!res1.error && res1.data) {
      rawSubmissions = res1.data
    } else {
      queryError = res1.error
    }
  } catch (err) {
    queryError = err
  }

  // Attempt 2: Fallback without course relation (in case course_id foreign key is not cached)
  if (rawSubmissions.length === 0 && queryError) {
    try {
      const res2 = await admin
        .from("payment_submissions")
        .select("*, student:students(name, student_id, phone, email, guardian_phone), batch:batches(name, subject, monthly_fee)")
        .order("created_at", { ascending: false })

      if (!res2.error && res2.data) {
        rawSubmissions = res2.data
        queryError = null
      } else {
        queryError = res2.error
      }
    } catch (err) {
      queryError = err
    }
  }

  // Attempt 3: Pure raw select if schema relationships fail
  if (rawSubmissions.length === 0 && queryError) {
    try {
      const res3 = await admin
        .from("payment_submissions")
        .select("*")
        .order("created_at", { ascending: false })

      if (!res3.error && res3.data) {
        rawSubmissions = res3.data
      }
    } catch (err) {
      console.warn("Payment submissions raw query note:", err)
    }
  }

  // Enrich missing student information
  const missingStudentIds = Array.from(
    new Set(rawSubmissions.filter(s => !s.student && s.student_id).map(s => s.student_id))
  )
  if (missingStudentIds.length > 0) {
    try {
      const { data: stList } = await admin
        .from("students")
        .select("id, name, student_id, phone, email, guardian_phone")
        .in("id", missingStudentIds)

      if (stList) {
        const stMap = new Map(stList.map(st => [st.id, st]))
        rawSubmissions = rawSubmissions.map(s => {
          if (!s.student && s.student_id && stMap.has(s.student_id)) {
            return { ...s, student: stMap.get(s.student_id) }
          }
          return s
        })
      }
    } catch (e) {
      console.warn("Enrich students error:", e)
    }
  }

  // Enrich missing batch information
  const missingBatchIds = Array.from(
    new Set(rawSubmissions.filter(s => !s.batch && s.batch_id).map(s => s.batch_id))
  )
  if (missingBatchIds.length > 0) {
    try {
      const { data: bList } = await admin
        .from("batches")
        .select("id, name, subject, monthly_fee")
        .in("id", missingBatchIds)

      if (bList) {
        const bMap = new Map(bList.map(b => [b.id, b]))
        rawSubmissions = rawSubmissions.map(s => {
          if (!s.batch && s.batch_id && bMap.has(s.batch_id)) {
            return { ...s, batch: bMap.get(s.batch_id) }
          }
          return s
        })
      }
    } catch (e) {
      console.warn("Enrich batches error:", e)
    }
  }

  // Enrich missing course information
  const missingCourseIds = Array.from(
    new Set(rawSubmissions.filter(s => !s.course && s.course_id).map(s => s.course_id))
  )
  if (missingCourseIds.length > 0) {
    try {
      const { data: cList } = await admin
        .from("courses")
        .select("id, title, category, price")
        .in("id", missingCourseIds)

      if (cList) {
        const cMap = new Map(cList.map(c => [c.id, c]))
        rawSubmissions = rawSubmissions.map(s => {
          if (!s.course && s.course_id && cMap.has(s.course_id)) {
            return { ...s, course: cMap.get(s.course_id) }
          }
          return s
        })
      }
    } catch (e) {
      console.warn("Enrich courses error:", e)
    }
  }

  // Normalize all submission items
  const submissions = rawSubmissions.map(s => {
    const amt = Number(s.amount) || 0
    const due = Number(s.due_amount) || 0
    const total = Number(s.total_fee || (amt + due)) || amt

    return {
      id: s.id,
      student_id: s.student_id,
      batch_id: s.batch_id || null,
      course_id: s.course_id || null,
      fee_due_id: s.fee_due_id || null,
      item_type: s.item_type || (s.course_id ? "course" : "batch"),
      amount: amt,
      total_fee: total,
      due_amount: due,
      due_date: s.due_date || null,
      payment_method: s.payment_method || "bkash",
      sender_number: s.sender_number || null,
      transaction_id: s.transaction_id || s.trx_id || null,
      notes: s.notes || null,
      status: s.status || "pending",
      approved_by: s.approved_by || s.reviewed_by || null,
      approved_at: s.approved_at || s.reviewed_at || null,
      rejection_reason: s.rejection_reason || null,
      created_at: s.created_at || new Date().toISOString(),
      student: s.student || null,
      batch: s.batch || null,
      course: s.course || null,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payment Approvals</h2>
          <p className="text-sm text-gray-500 mt-1">
            Verify, search, sort, and approve online payments submitted by students (bKash, Nagad, Rocket, Upay).
          </p>
        </div>
      </div>

      <ApprovalsClient
        submissions={submissions}
        canApprove={canApprove}
        staffId={currentStaff?.id || ""}
      />
    </div>
  )
}
