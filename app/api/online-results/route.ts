import { NextRequest, NextResponse } from "next/server"
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

// Helper to normalize an exam record with fallback tags from result_note
function normalizeExam(ex: any) {
  const note = ex.result_note || ""

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
    Boolean(ex.title?.includes("সাপ্তাহিক"))

  // Parse is_weekly_published: any weekly exam in online results portal has its weekly result published
  let isWeeklyPub = Boolean(isWeekly)

  // Parse published_days
  let pubDays: string[] = []
  if (Array.isArray(ex.published_days)) {
    pubDays = ex.published_days.map((d: any) => String(d).toLowerCase())
  } else if (typeof ex.published_days === "string" && ex.published_days.trim()) {
    try {
      const parsed = JSON.parse(ex.published_days)
      if (Array.isArray(parsed)) {
        pubDays = parsed.map((d: any) => String(d).toLowerCase())
      } else {
        pubDays = ex.published_days.split(",").map((d: string) => d.trim().toLowerCase()).filter(Boolean)
      }
    } catch {
      pubDays = ex.published_days.split(",").map((d: string) => d.trim().toLowerCase()).filter(Boolean)
    }
  }
  if (pubDays.length === 0 && note.includes("[PUBLISHED_DAYS:")) {
    try {
      const match = note.match(/\[PUBLISHED_DAYS:([^\]]*)\]/)
      if (match && match[1]) {
        pubDays = match[1].split(",").map((d: string) => d.trim().toLowerCase()).filter(Boolean)
      }
    } catch {}
  }

  // Parse is_public_result
  const isPubResult =
    ex.is_public_result === true ||
    note.includes("[PUBLIC_RESULT:true]") ||
    isWeeklyPub ||
    pubDays.length > 0 ||
    ex.is_published === true

  // Guarantee all 7 days for weekly exams
  let totalMarks = Number(ex.total_marks) || 100
  let passMarks = Number(ex.pass_marks) || 40
  if (isWeekly) {
    // Map configured days by canonical id
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
    if (sumTotal > 0) totalMarks = sumTotal
    if (sumPass > 0) passMarks = sumPass
  }

  return {
    ...ex,
    total_marks: totalMarks,
    pass_marks: passMarks,
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

      // If batch_id is present, ensure all enrolled students are included
      if (rawExam.batch_id) {
        try {
          const { data: enrollments } = await admin
            .from("enrollments")
            .select("student:students(id, name, student_id)")
            .eq("batch_id", rawExam.batch_id)
            .eq("status", "active")

          const enrolledStudents = (enrollments || []).map((e: any) => e.student).filter(Boolean)
          const existingIds = new Set(allResults.map((r) => r.student_id))

          for (const s of enrolledStudents) {
            if (!existingIds.has(s.id)) {
              allResults.push({
                id: `enr-${s.id}`,
                student_id: s.id,
                student_name: s.name,
                roll: s.student_id,
                obtained_marks: 0,
                student: s,
                day_marks: fallbackDayMarks[s.id] || {},
              })
            }
          }
        } catch (enrErr) {
          console.warn("Could not fetch enrolled students:", enrErr)
        }
      }

      // If students have entries in fallbackDayMarks but not in allResults
      if (Object.keys(fallbackDayMarks).length > 0) {
        const existingIds = new Set(allResults.map((r) => r.student_id))
        for (const sId of Object.keys(fallbackDayMarks)) {
          if (!existingIds.has(sId)) {
            try {
              const { data: st } = await admin.from("students").select("id, name, student_id").eq("id", sId).maybeSingle()
              if (st) {
                allResults.push({
                  id: `fb-${sId}`,
                  student_id: sId,
                  student_name: st.name,
                  roll: st.student_id,
                  obtained_marks: 0,
                  student: st,
                  day_marks: fallbackDayMarks[sId] || {},
                })
              }
            } catch {}
          }
        }
      }

      // Sort by obtained_marks descending (taking day marks into account for weekly exams)
      const isWeekly =
        exam.exam_schedule_type === "weekly" ||
        (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) ||
        exam.is_weekly_published === true

      const sorted = allResults
        .map((r) => {
          let sDayMarks = normalizeDayMarks(r.day_marks)
          if (
            (!sDayMarks || typeof sDayMarks !== "object" || Object.keys(sDayMarks).length === 0) &&
            fallbackDayMarks[r.student_id]
          ) {
            sDayMarks = normalizeDayMarks(fallbackDayMarks[r.student_id])
          }

          let dayTotal = 0
          let hasDayMark = false
          if (sDayMarks && typeof sDayMarks === "object") {
            for (const v of Object.values(sDayMarks)) {
              const m = typeof v === "object" && v !== null ? Number((v as any).marks) : Number(v)
              if (!isNaN(m)) {
                dayTotal += m
                hasDayMark = true
              }
            }
          }

          const rawObt = Number(r.obtained_marks ?? r.marks_obtained ?? 0)
          const finalObt = isWeekly && hasDayMark ? (dayTotal > 0 ? dayTotal : rawObt) : rawObt

          return {
            id: r.id,
            student_id: r.student?.id || r.student_id,
            student_name: r.student?.name || r.student_name || "Student",
            roll: r.student?.student_id || r.roll || "N/A",
            obtained_marks: finalObt,
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
          rank: curRank,
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
