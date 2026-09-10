import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

// GET: Fetch enrolled students and attendance records for a batch
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const batchId = searchParams.get("batch_id")
    const date = searchParams.get("date")
    const filter = searchParams.get("filter") || "all"

    if (!batchId) {
      return NextResponse.json({ error: "batch_id is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const supabase = await createClient()

    // 1. Fetch enrollments for this batch
    let enrollments: any[] = []
    const { data: enrData, error: enrErr } = await admin
      .from("enrollments")
      .select("*")
      .eq("batch_id", batchId)

    if (enrData && enrData.length > 0) {
      enrollments = enrData
    } else {
      const { data: sessionEnr } = await supabase
        .from("enrollments")
        .select("*")
        .eq("batch_id", batchId)
      if (sessionEnr) enrollments = sessionEnr
    }

    // Filter active enrollments if status is set, otherwise keep all
    const activeEnrollments = enrollments.filter(
      (e) => !e.status || e.status === "active" || e.status === "approved"
    )
    const targetEnrollments = activeEnrollments.length > 0 ? activeEnrollments : enrollments

    const studentIds = Array.from(
      new Set(targetEnrollments.map((e) => e.student_id).filter(Boolean))
    )

    // 2. Fetch students data
    let students: any[] = []
    if (studentIds.length > 0) {
      const { data: sData, error: sErr } = await admin
        .from("students")
        .select("*")
        .in("id", studentIds)

      if (sData && sData.length > 0) {
        students = sData
      } else {
        const { data: sessionS } = await supabase
          .from("students")
          .select("*")
          .in("id", studentIds)
        if (sessionS) students = sessionS
      }
    }

    const studentMap = new Map<string, any>()
    students.forEach((s) => studentMap.set(s.id, s))

    // 3. Resolve sequential roll numbers strictly starting from 1 to rest
    const resolvedStudents = targetEnrollments
      .map((e, idx) => {
        const s = studentMap.get(e.student_id)
        if (!s) return null

        const rawRoll =
          e.roll_no != null && Number(e.roll_no) > 0
            ? Number(e.roll_no)
            : e.batch_roll != null && Number(e.batch_roll) > 0
            ? Number(e.batch_roll)
            : s.roll_no != null && Number(s.roll_no) > 0
            ? Number(s.roll_no)
            : s.batch_roll != null && Number(s.batch_roll) > 0
            ? Number(s.batch_roll)
            : idx + 1

        return {
          id: s.id,
          student_id: s.student_id || `ID-${s.id.slice(0, 5)}`,
          name: s.name || "Student",
          phone: s.phone || "",
          guardian_phone: s.guardian_phone || "",
          roll_no: Number(rawRoll),
          batch_roll: Number(rawRoll),
          enrollment_date: e.enrollment_date || e.created_at || "",
        }
      })
      .filter(Boolean)

    // Sort strictly by roll number ascending (1, 2, 3...)
    resolvedStudents.sort((a: any, b: any) => (a.roll_no || 9999) - (b.roll_no || 9999))

    // 4. Fetch attendance records for this batch
    let attQuery = admin.from("attendance").select("*").eq("batch_id", batchId)

    if (filter === "this_month") {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
      attQuery = attQuery.gte("date", firstDay)
    } else if (filter === "last_month") {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
      attQuery = attQuery.gte("date", firstDay).lte("date", lastDay)
    }

    let attendanceRecords: any[] = []
    const { data: attData } = await attQuery
    if (attData) {
      attendanceRecords = attData
    } else {
      const { data: sessionAtt } = await supabase
        .from("attendance")
        .select("*")
        .eq("batch_id", batchId)
      if (sessionAtt) attendanceRecords = sessionAtt
    }

    // 5. Existing attendance records for selected date
    const targetDate = date || new Date().toISOString().split("T")[0]
    const dateRecords = attendanceRecords.filter((a) => a.date === targetDate)

    return NextResponse.json({
      students: resolvedStudents,
      attendance: attendanceRecords,
      dateAttendance: dateRecords,
      totalStudents: resolvedStudents.length,
    })
  } catch (error: any) {
    console.error("API Batch Attendance Data Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch batch attendance data" },
      { status: 500 }
    )
  }
}

// POST: Save or Upsert Attendance records securely via admin client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { records } = body

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Records array is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const supabase = await createClient()

    const sanitizedRecords = records.map((r: any) => ({
      student_id: r.student_id,
      batch_id: r.batch_id,
      date: r.date,
      status: r.status || "present",
      note: r.note || null,
      entry_method: r.entry_method || "manual",
      checked_in_at: new Date().toISOString(),
    }))

    // Upsert using admin client
    let { error } = await admin
      .from("attendance")
      .upsert(sanitizedRecords, { onConflict: "student_id,batch_id,date" })

    if (error) {
      // Fallback to session client
      const fb = await supabase
        .from("attendance")
        .upsert(sanitizedRecords, { onConflict: "student_id,batch_id,date" })
      if (fb.error) throw fb.error
    }

    return NextResponse.json({
      success: true,
      count: sanitizedRecords.length,
    })
  } catch (error: any) {
    console.error("API Save Attendance Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to save attendance" },
      { status: 500 }
    )
  }
}
