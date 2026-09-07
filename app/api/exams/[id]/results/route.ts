import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to check if exam results are public to the entire batch
export function isExamPublic(exam: any): boolean {
  if (!exam) return true
  if (exam.show_all_results === false) return false
  if (typeof exam.result_note === "string" && exam.result_note.includes("[SHOW_ALL_RESULTS:false]")) {
    return false
  }
  if (typeof exam.instructions === "string" && exam.instructions.includes("[SHOW_ALL_RESULTS:false]")) {
    return false
  }
  return true
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params
    const examId = resolvedParams.id
    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    // 1. Fetch exam details
    const { data: exam, error: examErr } = await admin
      .from("exams")
      .select("*, batch:batches(id, name)")
      .eq("id", examId)
      .maybeSingle()

    if (examErr || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    // 2. Determine user role / permissions
    let isStaffOrAdmin = false
    const { data: profile } = await admin
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (
      profile?.role === "owner" ||
      profile?.role === "admin" ||
      profile?.role === "manager" ||
      profile?.role === "teacher" ||
      user.user_metadata?.role === "owner" ||
      user.user_metadata?.role === "admin" ||
      user.user_metadata?.role === "manager" ||
      user.user_metadata?.role === "teacher"
    ) {
      isStaffOrAdmin = true
    }

    const showAllToStudents = isExamPublic(exam)

    // 3. Find current student ID if student
    let currentStudentId: string | null = null
    if (!isStaffOrAdmin) {
      // Find matching student by auth_user_id, student_id code, or email
      const { data: sAuth } = await admin
        .from("students")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
      if (sAuth) currentStudentId = sAuth.id

      if (!currentStudentId && profile?.user_id) {
        const { data: sCode } = await admin
          .from("students")
          .select("id")
          .eq("student_id", profile.user_id)
          .maybeSingle()
        if (sCode) currentStudentId = sCode.id
      }

      if (!currentStudentId && user.email) {
        const { data: sEmail } = await admin
          .from("students")
          .select("id")
          .ilike("email", user.email)
          .maybeSingle()
        if (sEmail) currentStudentId = sEmail.id
      }
    }

    // 4. Fetch results
    if (isStaffOrAdmin || showAllToStudents) {
      // Public mode or Admin view: return all students' results with ranking
      let allResults: any[] | null = null
      const { data: resultsData, error: resErr } = await admin
        .from("exam_results")
        .select("*, student:students(id, name, student_id, phone)")
        .eq("exam_id", examId)

      if (resErr) {
        // Fallback without wildcard if newer columns aren't in schema cache
        const { data: fbData, error: fbErr } = await admin
          .from("exam_results")
          .select("id, exam_id, student_id, obtained_marks, grade, rank, created_at, student:students(id, name, student_id, phone)")
          .eq("exam_id", examId)
        if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 })
        allResults = fbData
      } else {
        allResults = resultsData
      }

      // Extract day marks fallback note if available
      let fallbackStudentDayMarks: Record<string, any> = {}
      if (exam.result_note?.includes("[STUDENT_DAY_MARKS:")) {
        try {
          const match = exam.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
          if (match && match[1]) {
            fallbackStudentDayMarks = JSON.parse(match[1])
          }
        } catch {}
      }

      // Sort strictly by obtained_marks descending (highest to lowest)
      const sorted = [...(allResults || [])].map((item: any) => {
        let sDayMarks = item.day_marks
        if ((!sDayMarks || typeof sDayMarks !== "object" || Object.keys(sDayMarks).length === 0) && fallbackStudentDayMarks[item.student_id]) {
          sDayMarks = fallbackStudentDayMarks[item.student_id]
        }
        return {
          ...item,
          day_marks: sDayMarks || {},
        }
      }).sort((a: any, b: any) => {
        const marksA = Number(a.obtained_marks) || 0
        const marksB = Number(b.obtained_marks) || 0
        return marksB - marksA
      })

      // Calculate ranks strictly from highest to lowest marks (handling ties)
      let currentRank = 1
      const ranked = sorted.map((item: any, idx: number) => {
        if (idx > 0) {
          const prevMarks = Number(sorted[idx - 1].obtained_marks) || 0
          const curMarks = Number(item.obtained_marks) || 0
          if (curMarks < prevMarks) {
            currentRank = idx + 1
          }
        }
        return {
          ...item,
          rank: currentRank,
          is_current_student: currentStudentId ? item.student_id === currentStudentId : false,
        }
      })

      // Auto-heal: If any student had an outdated rank in the database, update it in background
      for (const item of ranked) {
        const originalRank = allResults?.find((r: any) => r.id === item.id)?.rank
        if (item.id && item.rank !== originalRank) {
          admin.from("exam_results").update({ rank: item.rank }).eq("id", item.id).then(() => {})
        }
      }

      return NextResponse.json({
        success: true,
        exam: {
          ...exam,
          show_all_results: showAllToStudents,
        },
        results: ranked,
        can_view_all: true,
        is_private: false,
        current_student_id: currentStudentId,
      })
    } else {
      // Private mode for students: Return ONLY current student's score, but calculate TRUE rank
      if (!currentStudentId) {
        return NextResponse.json({
          success: true,
          exam: {
            ...exam,
            show_all_results: false,
          },
          results: [],
          can_view_all: false,
          is_private: true,
          current_student_id: null,
          message: "No student record linked to this account",
        })
      }

      // Fetch all results to accurately calculate rank from highest to lowest
      const { data: allExamResults } = await admin
        .from("exam_results")
        .select("id, student_id, obtained_marks")
        .eq("exam_id", examId)

      const sortedAll = [...(allExamResults || [])].sort((a: any, b: any) => {
        const marksA = Number(a.obtained_marks) || 0
        const marksB = Number(b.obtained_marks) || 0
        return marksB - marksA
      })

      let computedRank = 1
      for (let i = 0; i < sortedAll.length; i++) {
        if (i > 0) {
          const prev = Number(sortedAll[i - 1].obtained_marks) || 0
          const cur = Number(sortedAll[i].obtained_marks) || 0
          if (cur < prev) computedRank = i + 1
        }
        if (sortedAll[i].student_id === currentStudentId) {
          break
        }
      }

      const { data: ownResult } = await admin
        .from("exam_results")
        .select("id, exam_id, student_id, obtained_marks, grade, rank, created_at, student:students(id, name, student_id, phone)")
        .eq("exam_id", examId)
        .eq("student_id", currentStudentId)
        .maybeSingle()

      if (ownResult && ownResult.rank !== computedRank) {
        admin.from("exam_results").update({ rank: computedRank }).eq("id", ownResult.id).then(() => {})
      }

      return NextResponse.json({
        success: true,
        exam: {
          ...exam,
          show_all_results: false,
        },
        results: ownResult ? [{ ...ownResult, rank: computedRank, is_current_student: true }] : [],
        can_view_all: false,
        is_private: true,
        current_student_id: currentStudentId,
        message: "Private results: Only visible to you",
      })
    }
  } catch (err: any) {
    console.error("Exam results API error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params
    const examId = resolvedParams.id
    const body = await req.json()
    const { show_all_results } = body

    if (typeof show_all_results !== "boolean") {
      return NextResponse.json({ error: "show_all_results boolean required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    // 1. Fetch current exam to get result_note
    const { data: currentExam } = await admin
      .from("exams")
      .select("result_note, show_all_results")
      .eq("id", examId)
      .maybeSingle()

    let updatedNote = currentExam?.result_note || ""
    // Clean out previous tags
    updatedNote = updatedNote
      .replace(/\[SHOW_ALL_RESULTS:(true|false)\]/g, "")
      .trim()
    // Append the new state tag for permanent fallback resilience
    updatedNote = (updatedNote ? updatedNote + " " : "") + `[SHOW_ALL_RESULTS:${show_all_results}]`

    // 2. Update with column + fallback tag
    try {
      const { error } = await admin
        .from("exams")
        .update({
          show_all_results: show_all_results,
          result_note: updatedNote,
        })
        .eq("id", examId)

      if (error) {
        console.warn("Direct show_all_results column update warning, falling back to note:", error)
        // Fallback update without column
        await admin
          .from("exams")
          .update({ result_note: updatedNote })
          .eq("id", examId)
      }
    } catch (dbErr) {
      console.warn("Database update fallback caught:", dbErr)
      await admin
        .from("exams")
        .update({ result_note: updatedNote })
        .eq("id", examId)
    }

    return NextResponse.json({
      success: true,
      show_all_results: show_all_results,
      message: show_all_results
        ? "Batch merit list is now visible to all students."
        : "Exam marks set to private. Students will only see their own marks.",
    })
  } catch (err: any) {
    console.error("Update exam visibility error:", err)
    return NextResponse.json({ error: err.message || "Failed to update" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params
    const examId = resolvedParams.id
    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const admin = createAdminClient()

    // 1. Fetch current exam
    const { data: currentExam, error: examErr } = await admin
      .from("exams")
      .select("id, total_marks, recurring_days, exam_schedule_type, result_note")
      .eq("id", examId)
      .maybeSingle()

    if (examErr || !currentExam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    // Support both single student save and batch save
    const updates: Array<{
      student_id: string
      obtained_marks: number
      grade: string
      day_marks?: Record<string, any>
    }> = []

    if (Array.isArray(body.batch_updates)) {
      for (const u of body.batch_updates) {
        if (u.student_id) {
          updates.push({
            student_id: u.student_id,
            obtained_marks: Number(u.obtained_marks) || 0,
            grade: u.grade || "",
            day_marks: u.day_marks || {},
          })
        }
      }
    } else if (body.student_id) {
      updates.push({
        student_id: body.student_id,
        obtained_marks: Number(body.obtained_marks) || 0,
        grade: body.grade || "",
        day_marks: body.day_marks || {},
      })
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No student marks provided" }, { status: 400 })
    }

    // Upsert into exam_results with day_marks
    const payloadWithDayMarks = updates.map((u) => ({
      exam_id: examId,
      student_id: u.student_id,
      obtained_marks: u.obtained_marks,
      grade: u.grade,
      day_marks: u.day_marks || {},
    }))

    const { error: upsertErr } = await admin
      .from("exam_results")
      .upsert(payloadWithDayMarks, { onConflict: "exam_id,student_id" })

    if (upsertErr) {
      console.warn("Attempting exam_results upsert without day_marks column:", upsertErr.message)
      // Fallback without day_marks column
      const payloadWithoutDayMarks = updates.map((u) => ({
        exam_id: examId,
        student_id: u.student_id,
        obtained_marks: u.obtained_marks,
        grade: u.grade,
      }))

      const { error: fbErr } = await admin
        .from("exam_results")
        .upsert(payloadWithoutDayMarks, { onConflict: "exam_id,student_id" })

      if (fbErr) {
        return NextResponse.json({ error: fbErr.message }, { status: 500 })
      }
    }

    // Always ensure day marks are backed up into exams.result_note [STUDENT_DAY_MARKS:...]
    let existingMap: Record<string, Record<string, any>> = {}
    if (currentExam.result_note?.includes("[STUDENT_DAY_MARKS:")) {
      try {
        const m = currentExam.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
        if (m && m[1]) {
          existingMap = JSON.parse(m[1])
        }
      } catch {}
    }

    // Merge provided all_day_marks or the updates
    const mergedMap: Record<string, Record<string, any>> = {
      ...existingMap,
      ...(body.all_day_marks || {}),
    }
    for (const u of updates) {
      if (u.day_marks && Object.keys(u.day_marks).length > 0) {
        mergedMap[u.student_id] = {
          ...(mergedMap[u.student_id] || {}),
          ...u.day_marks,
        }
      }
    }

    const currentNote = currentExam.result_note || ""
    const updatedNote = currentNote.replace(/\[STUDENT_DAY_MARKS:[^\]]*\]/g, "").trim() +
      ` [STUDENT_DAY_MARKS:${JSON.stringify(mergedMap)}]`

    await admin
      .from("exams")
      .update({ result_note: updatedNote })
      .eq("id", examId)

    return NextResponse.json({
      success: true,
      message: "Marks saved successfully",
      saved_count: updates.length,
      all_day_marks: mergedMap,
    })
  } catch (err: any) {
    console.error("Exam results POST error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

