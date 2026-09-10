import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import StudentsClient from "../../owner/students/StudentsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ReceptionStudentsPage() {
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

  // 3. Stitch enrollments + batch names to students
  const batchMap = new Map<string, any>()
  batches.forEach((b: any) => batchMap.set(b.id, b))

  const rawStudentMap = new Map<string, any>()
  rawStudents.forEach((s: any) => {
    if (s.id) rawStudentMap.set(String(s.id), s)
    if (s.student_id) rawStudentMap.set(String(s.student_id), s)
  })

  // Sort enrollments deterministically by created_at or id to calculate stable fallback roll numbers
  const sortedRawEnrollments = [...rawEnrollments].sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0
    if (tA !== tB) return tA - tB
    return String(a.id || "").localeCompare(String(b.id || ""))
  })

  const batchCounters = new Map<string, number>()
  const enrFallbackRollMap = new Map<string, number>()
  sortedRawEnrollments.forEach((e: any) => {
    const bId = e.batch_id || "default"
    const nextSeq = (batchCounters.get(bId) || 0) + 1
    batchCounters.set(bId, nextSeq)
    enrFallbackRollMap.set(e.id, nextSeq)
  })

  const enrollmentsByStudent = new Map<string, any[]>()
  sortedRawEnrollments.forEach((e: any) => {
    if (!e.student_id) return
    const sObj = rawStudentMap.get(String(e.student_id))
    const fallbackSeq = enrFallbackRollMap.get(e.id) || 1
    const roll = (e.roll_no != null && Number(e.roll_no) > 0)
      ? Number(e.roll_no)
      : ((sObj?.roll_no != null && Number(sObj.roll_no) > 0)
          ? Number(sObj.roll_no)
          : ((sObj?.batch_roll != null && Number(sObj.batch_roll) > 0)
              ? Number(sObj.batch_roll)
              : fallbackSeq))

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
    const uniqueEnrs = Array.from(new Map(sEnrs.map((item: any) => [item.id, item])).values())
    const firstRoll = uniqueEnrs.find((e: any) => e.roll_no != null)?.roll_no
    return {
      ...s,
      roll_no: firstRoll ?? s.roll_no ?? s.batch_roll ?? (uniqueEnrs.length > 0 ? 1 : null),
      batch_roll: firstRoll ?? s.batch_roll ?? s.roll_no ?? (uniqueEnrs.length > 0 ? 1 : null),
      enrollments: uniqueEnrs
    }
  })

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">Students</h2><p className="text-sm text-slate-500 mt-1">{students.length} total students</p></div>
      <StudentsClient students={students} batches={batches} />
    </div>
  )
}
