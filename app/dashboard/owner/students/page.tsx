import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import StudentsClient from "./StudentsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function StudentsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1. Fetch students from admin, fallback to session client
  let rawStudents: any[] = []
  try {
    const { data, error } = await admin.from("students").select("*").order("created_at", { ascending: false })
    if (!error && data && data.length > 0) {
      rawStudents = data
    } else {
      const { data: fb } = await supabase.from("students").select("*").order("created_at", { ascending: false })
      if (fb) rawStudents = fb
    }
  } catch {
    try {
      const { data: fb } = await supabase.from("students").select("*").order("created_at", { ascending: false })
      if (fb) rawStudents = fb
    } catch {}
  }

  // 2. Fetch enrollments & batches reliably
  let rawEnrollments: any[] = []
  try {
    const { data: enrData, error: enrErr } = await admin.from("enrollments").select("id, student_id, batch_id, status, branch_id, roll_no")
    if (!enrErr && enrData && enrData.length > 0) {
      rawEnrollments = enrData
    } else {
      const { data: fbEnr } = await supabase.from("enrollments").select("id, student_id, batch_id, status, branch_id, roll_no")
      if (fbEnr && fbEnr.length > 0) {
        rawEnrollments = fbEnr
      } else {
        const { data: rawAll } = await admin.from("enrollments").select("*")
        if (rawAll) rawEnrollments = rawAll
      }
    }
  } catch {
    try {
      const { data: fbEnr } = await supabase.from("enrollments").select("*")
      if (fbEnr) rawEnrollments = fbEnr
    } catch {}
  }

  let batches: any[] = []
  try {
    const { data: bData } = await admin.from("batches").select("id, name, branch_id, is_active")
    if (bData && bData.length > 0) {
      batches = bData
    } else {
      const { data: fbB } = await supabase.from("batches").select("id, name, branch_id, is_active")
      if (fbB) batches = fbB
    }
  } catch {
    try {
      const { data: fbB } = await supabase.from("batches").select("id, name, branch_id, is_active")
      if (fbB) batches = fbB
    } catch {}
  }

  // 3. Fetch dues, exam results, user/staff
  const [feeDuesRes, examResultsRes, userRes] = await Promise.all([
    admin.from("fee_dues").select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status").order("due_date", { ascending: true }),
    admin.from("exam_results").select("student_id, obtained_marks, exams(total_marks)"),
    supabase.auth.getUser()
  ])

  let feeDues = feeDuesRes.data || []
  if (feeDues.length === 0) {
    const { data: fbDues } = await supabase.from("fee_dues").select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status")
    if (fbDues) feeDues = fbDues
  }

  let examResults = examResultsRes.data || []
  const user = userRes.data?.user

  // 4. Stitch enrollments + batch names to students
  const batchMap = new Map<string, any>()
  batches.forEach((b: any) => batchMap.set(b.id, b))

  const rawStudentMap = new Map<string, any>()
  rawStudents.forEach((s: any) => {
    if (s.id) rawStudentMap.set(String(s.id), s)
    if (s.student_id) rawStudentMap.set(String(s.student_id), s)
  })

  const enrollmentsByStudent = new Map<string, any[]>()
  rawEnrollments.forEach((e: any) => {
    if (!e.student_id) return
    const sObj = rawStudentMap.get(String(e.student_id))
    const roll = e.roll_no ?? sObj?.roll_no ?? sObj?.batch_roll ?? null
    const item = {
      ...e,
      roll_no: roll,
      batch: batchMap.get(e.batch_id) || { name: "Enrolled Batch" }
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
    if (sObj?.student_id && String(sObj.student_id) !== sKey) {
      const cList = enrollmentsByStudent.get(String(sObj.student_id)) || []
      cList.push(item)
      enrollmentsByStudent.set(String(sObj.student_id), cList)
    }
  })

  const students = rawStudents.map((s: any) => {
    const sEnrs = (enrollmentsByStudent.get(String(s.id)) || []).concat(
      s.student_id && s.student_id !== s.id ? (enrollmentsByStudent.get(String(s.student_id)) || []) : []
    )
    // Deduplicate any duplicates if both were indexed
    const uniqueEnrs = Array.from(new Map(sEnrs.map((item: any) => [item.id, item])).values())
    const firstRoll = uniqueEnrs.find((e: any) => e.roll_no != null)?.roll_no
    return {
      ...s,
      roll_no: firstRoll ?? s.roll_no ?? s.batch_roll ?? null,
      batch_roll: firstRoll ?? s.batch_roll ?? s.roll_no ?? null,
      enrollments: uniqueEnrs
    }
  })

  const { data: staff } = user
    ? await admin.from("staff").select("id, name, email, role").eq("auth_user_id", user.id).maybeSingle()
    : { data: null }

  let initialDeletionRequests: any[] = []
  try {
    const { data: requests } = await admin
      .from("student_deletion_requests")
      .select("*")
      .order("created_at", { ascending: false })
    if (requests) initialDeletionRequests = requests
  } catch (e) {
    // Falls back gracefully
  }

  const currentStaff = staff || {
    id: user?.id || "admin-owner",
    name: user?.user_metadata?.name || "Admin Owner",
    email: user?.email || "admin@medhashiree.com",
    role: "owner" as const,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-sm text-gray-500 mt-1">{students.length} total students</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/owner/students/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
            + Add Student
          </Link>
        </div>
      </div>
      <StudentsClient 
        students={students} 
        batches={batches}
        dueData={(feeDues as any) || []}
        examData={examResults as any || []}
        currentStaff={currentStaff}
        initialDeletionRequests={initialDeletionRequests}
      />
    </div>
  )
}
