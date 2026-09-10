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
    const { data: enrData, error: enrErr } = await admin.from("enrollments").select("id, student_id, batch_id, status, branch_id, roll_no, batch_roll")
    if (!enrErr && enrData && enrData.length > 0) {
      rawEnrollments = enrData
    } else {
      const { data: fbEnr } = await supabase.from("enrollments").select("id, student_id, batch_id, status, branch_id, roll_no, batch_roll")
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
  rawStudents.forEach((s: any) => rawStudentMap.set(s.id, s))

  const enrollmentsByStudent = new Map<string, any[]>()
  rawEnrollments.forEach((e: any) => {
    if (!e.student_id) return
    const sObj = rawStudentMap.get(e.student_id)
    const roll = e.roll_no ?? e.batch_roll ?? sObj?.roll_no ?? sObj?.batch_roll ?? null
    const item = {
      ...e,
      roll_no: roll,
      batch: batchMap.get(e.batch_id) || { name: "Enrolled Batch" }
    }
    const list = enrollmentsByStudent.get(e.student_id) || []
    list.push(item)
    enrollmentsByStudent.set(e.student_id, list)
  })

  const students = rawStudents.map((s: any) => {
    const sEnrs = enrollmentsByStudent.get(s.id) || []
    const firstRoll = sEnrs.find(e => e.roll_no != null)?.roll_no
    return {
      ...s,
      roll_no: firstRoll ?? s.roll_no ?? s.batch_roll ?? null,
      batch_roll: firstRoll ?? s.batch_roll ?? s.roll_no ?? null,
      enrollments: sEnrs
    }
  })

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">Students</h2><p className="text-sm text-slate-500 mt-1">{students.length} total students</p></div>
      <StudentsClient students={students} batches={batches} />
    </div>
  )
}
