import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

export function normalizeDayMarks(days: Record<string, any> | undefined | null): Record<string, any> {
  if (!days || typeof days !== "object") return {}
  const normalized: Record<string, any> = {}
  for (const [key, val] of Object.entries(days)) {
    if (!val) continue
    const lowerKey = key.trim().toLowerCase()
    const matched = ALL_WEEK_DAYS.find((d) => d.id === lowerKey || d.bn === key || d.en.toLowerCase() === lowerKey)
    const canonicalKey = matched ? matched.id : lowerKey
    if (!normalized[canonicalKey] || (typeof val === "object" && val !== null && "marks" in val)) {
      normalized[canonicalKey] = val
    }
  }
  return normalized
}

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

    // Compute cumulative total_marks and pass_marks for weekly exams (all 7 days)
    let cumulativeTotal = Number(exam.total_marks) || 100
    let cumulativePass = Number(exam.pass_marks) || 40
    const isWeeklyExam =
      exam.exam_schedule_type === "weekly" ||
      (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) ||
      exam.is_weekly_published === true ||
      Boolean(exam.title?.includes("সাপ্তাহিক"))

    if (isWeeklyExam) {
      const recDays = Array.isArray(exam.recurring_days) ? exam.recurring_days : []
      const confMap: Record<string, any> = {}
      for (const d of recDays) {
        const isObj = typeof d === "object" && d !== null
        const rawKey = isObj ? (d.day || d.day_bn || d.day_en || "") : String(d)
        const lowerKey = String(rawKey).toLowerCase()
        const matched = ALL_WEEK_DAYS.find((w) => w.id === lowerKey || w.bn === rawKey || w.en.toLowerCase() === lowerKey)
        const canonicalKey = matched?.id || lowerKey
        confMap[canonicalKey] = d
      }

      let sumTotal = 0
      let sumPass = 0
      for (const w of ALL_WEEK_DAYS) {
        const conf = confMap[w.id]
        const dTotal = conf && typeof conf === "object" && conf.total_marks ? Number(conf.total_marks) : 50
        const dPass = conf && typeof conf === "object" && conf.pass_marks ? Number(conf.pass_marks) : 20
        sumTotal += dTotal
        sumPass += dPass
      }
      if (sumTotal > 0) cumulativeTotal = sumTotal
      if (sumPass > 0) cumulativePass = sumPass
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
        let sDayMarks = normalizeDayMarks(item.day_marks)
        if (Object.keys(sDayMarks).length === 0 && fallbackStudentDayMarks[item.student_id]) {
          sDayMarks = normalizeDayMarks(fallbackStudentDayMarks[item.student_id])
        }
        return {
          ...item,
          day_marks: sDayMarks,
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
          total_marks: cumulativeTotal,
          pass_marks: cumulativePass,
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
            total_marks: cumulativeTotal,
            pass_marks: cumulativePass,
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
        .select("id, exam_id, student_id, obtained_marks, grade, rank, day_marks, created_at, student:students(id, name, student_id, phone)")
        .eq("exam_id", examId)
        .eq("student_id", currentStudentId)
        .maybeSingle()

      let fallbackStudentDayMarks: Record<string, any> = {}
      if (exam.result_note?.includes("[STUDENT_DAY_MARKS:")) {
        try {
          const match = exam.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
          if (match && match[1]) {
            fallbackStudentDayMarks = JSON.parse(match[1])
          }
        } catch {}
      }

      let ownDayMarks = normalizeDayMarks(ownResult?.day_marks)
      if (Object.keys(ownDayMarks).length === 0 && fallbackStudentDayMarks[currentStudentId]) {
        ownDayMarks = normalizeDayMarks(fallbackStudentDayMarks[currentStudentId])
      }

      if (ownResult && ownResult.rank !== computedRank) {
        admin.from("exam_results").update({ rank: computedRank }).eq("id", ownResult.id).then(() => {})
      }

      return NextResponse.json({
        success: true,
        exam: {
          ...exam,
          total_marks: cumulativeTotal,
          pass_marks: cumulativePass,
          show_all_results: false,
        },
        results: ownResult ? [{ ...ownResult, day_marks: ownDayMarks || {}, rank: computedRank, is_current_student: true }] : [],
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
      .select("id, title, total_marks, recurring_days, exam_schedule_type, result_note")
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

    // 2. Fetch existing exam_results for all updating students to guarantee deep-merging
    const studentIds = updates.map((u) => u.student_id)
    const { data: existingRows } = await admin
      .from("exam_results")
      .select("student_id, obtained_marks, grade, day_marks")
      .eq("exam_id", examId)
      .in("student_id", studentIds)

    const existingStudentMap: Record<string, any> = {}
    for (const r of existingRows || []) {
      existingStudentMap[r.student_id] = r
    }

    // Extract fallback day marks from exam result_note
    let existingNoteMap: Record<string, Record<string, any>> = {}
    if (currentExam.result_note?.includes("[STUDENT_DAY_MARKS:")) {
      try {
        const m = currentExam.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
        if (m && m[1]) {
          existingNoteMap = JSON.parse(m[1])
        }
      } catch {}
    }

    // Calculate weekly max marks (all 7 days)
    const isWeekly =
      currentExam.exam_schedule_type === "weekly" ||
      (Array.isArray(currentExam.recurring_days) && currentExam.recurring_days.length > 0) ||
      currentExam.result_note?.includes("[WEEKLY_SCHEDULE:") ||
      currentExam.result_note?.includes("[WEEKLY_DAYS:") ||
      Boolean(currentExam.title?.includes("সাপ্তাহিক"))

    let calculatedWeeklyMax = 0
    let calculatedWeeklyPass = 0
    if (isWeekly) {
      const recDays = Array.isArray(currentExam.recurring_days) ? currentExam.recurring_days : []
      const confMap: Record<string, any> = {}
      for (const d of recDays) {
        const isObj = typeof d === "object" && d !== null
        const rawKey = isObj ? (d.day || d.day_bn || d.day_en || "") : String(d)
        const lowerKey = String(rawKey).toLowerCase()
        const matched = ALL_WEEK_DAYS.find((w) => w.id === lowerKey || w.bn === rawKey || w.en.toLowerCase() === lowerKey)
        const canonicalKey = matched?.id || lowerKey
        confMap[canonicalKey] = d
      }

      for (const w of ALL_WEEK_DAYS) {
        const conf = confMap[w.id]
        const dTotal = conf && typeof conf === "object" && conf.total_marks ? Number(conf.total_marks) : 50
        const dPass = conf && typeof conf === "object" && conf.pass_marks ? Number(conf.pass_marks) : 20
        calculatedWeeklyMax += dTotal
        calculatedWeeklyPass += dPass
      }
    }

    // Auto-heal exam.total_marks in database if it was wrongly saved as 50 or 300 instead of 350!
    if (calculatedWeeklyMax > 0 && (!currentExam.total_marks || Number(currentExam.total_marks) < calculatedWeeklyMax)) {
      admin.from("exams").update({
        total_marks: calculatedWeeklyMax,
        pass_marks: calculatedWeeklyPass > 0 ? calculatedWeeklyPass : Math.round(calculatedWeeklyMax * 0.4),
      }).eq("id", examId).then(() => {})
    }

    const effectiveTotalMarks = calculatedWeeklyMax > 0 ? calculatedWeeklyMax : (Number(currentExam.total_marks) || 100)

    // Deep merge day marks for every student
    const mergedUpdates = updates.map((u) => {
      const existingRow = existingStudentMap[u.student_id]
      let existingDays: Record<string, any> = {}

      if (existingRow?.day_marks && typeof existingRow.day_marks === "object") {
        existingDays = { ...existingRow.day_marks }
      } else if (typeof existingRow?.day_marks === "string") {
        try { existingDays = JSON.parse(existingRow.day_marks) } catch {}
      }

      if (Object.keys(existingDays).length === 0 && existingNoteMap[u.student_id]) {
        existingDays = { ...existingNoteMap[u.student_id] }
      }

      // Merge existing days with incoming updates with canonical lowercase keys
      const mergedDays: Record<string, any> = {
        ...normalizeDayMarks(existingDays),
        ...normalizeDayMarks(u.day_marks),
      }

      // Recalculate true cumulative grand total across all merged days
      let cumulativeGrandTotal = 0
      let hasAnyDay = false
      for (const dayItem of Object.values(mergedDays)) {
        const m = typeof dayItem === "object" && dayItem !== null ? Number((dayItem as any).marks) : Number(dayItem)
        if (!isNaN(m)) {
          cumulativeGrandTotal += m
          hasAnyDay = true
        }
      }

      const finalObtainedMarks = hasAnyDay ? cumulativeGrandTotal : (Number(u.obtained_marks) || 0)
      
      // Calculate grade
      let grade = u.grade
      if (!grade || hasAnyDay) {
        const pct = (finalObtainedMarks / effectiveTotalMarks) * 100
        if (pct >= 80) grade = "A+"
        else if (pct >= 70) grade = "A"
        else if (pct >= 60) grade = "A-"
        else if (pct >= 50) grade = "B"
        else if (pct >= 40) grade = "C"
        else if (pct >= 33) grade = "D"
        else grade = "F"
      }

      return {
        student_id: u.student_id,
        obtained_marks: finalObtainedMarks,
        grade,
        day_marks: mergedDays,
      }
    })

    // Upsert into exam_results with day_marks
    const payloadWithDayMarks = mergedUpdates.map((u) => ({
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
      const payloadWithoutDayMarks = mergedUpdates.map((u) => ({
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

    // Backup day marks into exams.result_note [STUDENT_DAY_MARKS:...]
    const mergedMap: Record<string, Record<string, any>> = {}
    for (const [stId, dMap] of Object.entries(existingNoteMap)) {
      mergedMap[stId] = normalizeDayMarks(dMap)
    }
    if (body.all_day_marks && typeof body.all_day_marks === "object") {
      for (const [stId, dMap] of Object.entries(body.all_day_marks)) {
        mergedMap[stId] = {
          ...(mergedMap[stId] || {}),
          ...normalizeDayMarks(dMap as any),
        }
      }
    }
    for (const u of mergedUpdates) {
      if (u.day_marks && Object.keys(u.day_marks).length > 0) {
        mergedMap[u.student_id] = {
          ...(mergedMap[u.student_id] || {}),
          ...normalizeDayMarks(u.day_marks),
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

