import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to normalize an exam record with fallback tags from result_note
function normalizeExam(ex: any) {
  const note = ex.result_note || ""

  // Parse is_public_result
  const isPubResult =
    ex.is_public_result === true ||
    note.includes("[PUBLIC_RESULT:true]") ||
    ex.is_weekly_published === true ||
    note.includes("[IS_WEEKLY_PUBLISHED:true]")

  // Parse is_weekly_published
  const isWeeklyPub =
    ex.is_weekly_published === true ||
    note.includes("[IS_WEEKLY_PUBLISHED:true]")

  // Parse published_days
  let pubDays: string[] = []
  if (Array.isArray(ex.published_days)) {
    pubDays = ex.published_days
  } else if (note.includes("[PUBLISHED_DAYS:")) {
    try {
      const match = note.match(/\[PUBLISHED_DAYS:([^\]]*)\]/)
      if (match && match[1]) {
        pubDays = match[1].split(",").filter(Boolean)
      }
    } catch {}
  }

  // Parse recurring_days
  let recDays: any[] = []
  if (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) {
    recDays = ex.recurring_days
  } else if (note.includes("[RECURRING_DAYS:")) {
    try {
      const match = note.match(/\[RECURRING_DAYS:(.*?)\]/)
      if (match && match[1]) {
        recDays = JSON.parse(match[1])
      }
    } catch {}
  }

  const isWeekly =
    ex.exam_schedule_type === "weekly" ||
    recDays.length > 0 ||
    isWeeklyPub

  return {
    ...ex,
    is_public_result: isPubResult,
    is_weekly_published: isWeeklyPub,
    published_days: pubDays,
    recurring_days: recDays,
    exam_schedule_type: isWeekly ? "weekly" : (ex.exam_schedule_type || "everyday"),
    is_published: ex.is_published === true || isPubResult || isWeeklyPub || pubDays.length > 0,
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const { searchParams } = new URL(req.url)
    const examId = searchParams.get("exam_id")

    // If requesting details & merit list for a single exam
    if (examId) {
      const { data: rawExam, error: exErr } = await admin
        .from("exams")
        .select("*, branch:branches(id, name), batch:batches(id, name)")
        .eq("id", examId)
        .maybeSingle()

      if (exErr || !rawExam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 })
      }

      const exam = normalizeExam(rawExam)

      // Fetch exam results
      let allResults: any[] = []
      const { data: resData, error: resErr } = await admin
        .from("exam_results")
        .select("*, student:students(id, name, student_id)")
        .eq("exam_id", examId)

      if (resErr) {
        const { data: fbData } = await admin
          .from("exam_results")
          .select("id, exam_id, student_id, obtained_marks, grade, rank, created_at, student:students(id, name, student_id)")
          .eq("exam_id", examId)
        allResults = fbData || []
      } else {
        allResults = resData || []
      }

      // Extract day marks fallback from note if present
      let fallbackDayMarks: Record<string, any> = {}
      if (rawExam.result_note?.includes("[STUDENT_DAY_MARKS:")) {
        try {
          const match = rawExam.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
          if (match && match[1]) {
            fallbackDayMarks = JSON.parse(match[1])
          }
        } catch {}
      }

      // Sort by obtained_marks descending
      const sorted = allResults
        .map((r) => {
          let sDayMarks = r.day_marks
          if (
            (!sDayMarks || typeof sDayMarks !== "object" || Object.keys(sDayMarks).length === 0) &&
            fallbackDayMarks[r.student_id]
          ) {
            sDayMarks = fallbackDayMarks[r.student_id]
          }
          return {
            id: r.id,
            student_id: r.student?.id || r.student_id,
            student_name: r.student?.name || "Student",
            roll: r.student?.student_id || "N/A",
            obtained_marks: Number(r.obtained_marks ?? r.marks_obtained ?? 0),
            grade: r.grade || "",
            rank: r.rank || null,
            day_marks: sDayMarks || {},
          }
        })
        .sort((a, b) => b.obtained_marks - a.obtained_marks)

      // Calculate ranks with ties
      let curRank = 1
      const ranked = sorted.map((item, idx) => {
        if (idx > 0 && item.obtained_marks < sorted[idx - 1].obtained_marks) {
          curRank = idx + 1
        }
        return {
          ...item,
          rank: item.rank || curRank,
        }
      })

      return NextResponse.json({
        success: true,
        exam,
        results: ranked,
      })
    }

    // Otherwise: Return list of all published exams and active branches
    const [branchesRes, examsRes] = await Promise.all([
      admin.from("branches").select("id, name").eq("is_active", true),
      admin
        .from("exams")
        .select("*, branch:branches(id, name), batch:batches(id, name)")
        .order("exam_date", { ascending: false }),
    ])

    const branches = branchesRes.data || []
    const rawExams = examsRes.data || []

    // Filter to only exams that are published or public
    const publishedExams = rawExams
      .map(normalizeExam)
      .filter((ex) => {
        return (
          ex.is_public_result === true ||
          ex.is_published === true ||
          ex.is_weekly_published === true ||
          (Array.isArray(ex.published_days) && ex.published_days.length > 0)
        )
      })

    return NextResponse.json({
      success: true,
      branches,
      exams: publishedExams,
    })
  } catch (err: any) {
    console.error("Online results API error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
