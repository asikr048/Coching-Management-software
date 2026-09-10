import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

function getCanonicalDayId(raw: string): string {
  const low = String(raw).toLowerCase().trim()
  const matched = ALL_WEEK_DAYS.find((d) => d.id === low || d.bn === raw || d.en.toLowerCase() === low)
  return matched ? matched.id : low
}

function parseExistingPubDays(exam: any): string[] {
  let pubDays: string[] = []
  const raw = exam.published_days
  if (Array.isArray(raw)) {
    pubDays = raw.map((d: any) => getCanonicalDayId(d))
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) pubDays = parsed.map((d: any) => getCanonicalDayId(d))
      else pubDays = raw.split(",").map((s: string) => getCanonicalDayId(s)).filter(Boolean)
    } catch {
      pubDays = raw.split(",").map((s: string) => getCanonicalDayId(s)).filter(Boolean)
    }
  }

  const note = exam.result_note || ""
  if (note.includes("[PUBLISHED_DAYS:")) {
    try {
      const match = note.match(/\[PUBLISHED_DAYS:([^\]]*)\]/)
      if (match && match[1]) {
        const fromNote = match[1].split(",").map((s: string) => getCanonicalDayId(s)).filter(Boolean)
        pubDays = Array.from(new Set([...pubDays, ...fromNote]))
      }
    } catch {}
  }
  return pubDays
}

async function safeUpdateExam(admin: any, examId: string, payload: {
  result_note: string
  is_published?: boolean
  is_public_result?: boolean
  is_weekly_published?: boolean
  published_days?: any
}) {
  const safeData: any = {
    result_note: payload.result_note,
  }
  if (typeof payload.is_published === "boolean") safeData.is_published = payload.is_published
  if (typeof payload.is_public_result === "boolean") safeData.is_public_result = payload.is_public_result
  if (typeof payload.is_weekly_published === "boolean") safeData.is_weekly_published = payload.is_weekly_published
  if (payload.published_days !== undefined) safeData.published_days = payload.published_days

  const { data, error } = await admin
    .from("exams")
    .update(safeData)
    .eq("id", examId)
    .select("*, branch:branches(id, name), batch:batches(id, name)")
    .single()

  if (error) {
    console.warn("safeUpdateExam warning, retrying with fallback subset:", error.message)
    const fallbackData: any = { result_note: payload.result_note }
    if (typeof payload.is_published === "boolean") fallbackData.is_published = payload.is_published
    const { data: d2, error: e2 } = await admin
      .from("exams")
      .update(fallbackData)
      .eq("id", examId)
      .select("*, branch:branches(id, name), batch:batches(id, name)")
      .single()

    if (e2) {
      const { data: d3, error: e3 } = await admin
        .from("exams")
        .update({ result_note: payload.result_note })
        .eq("id", examId)
        .select("*, branch:branches(id, name), batch:batches(id, name)")
        .single()
      if (e3) throw e3
      return d3
    }
    return d2
  }

  return data
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      exam_id,
      action = "unpublish", // "unpublish" | "delete_day" | "publish_day" | "toggle_weekly_total" | "delete_exam"
      day_key,
      is_weekly_published,
      delete_notices = true,
    } = body

    if (!exam_id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch current exam
    const { data: exam, error: exErr } = await admin
      .from("exams")
      .select("*")
      .eq("id", exam_id)
      .maybeSingle()

    if (exErr || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    if (action === "delete_exam") {
      // 1. Delete submissions, questions, results, answers
      const { data: submissions } = await admin
        .from("exam_submissions")
        .select("id")
        .eq("exam_id", exam_id)

      if (submissions && submissions.length > 0) {
        const subIds = submissions.map((s) => s.id)
        await admin.from("exam_answers").delete().in("submission_id", subIds)
      }
      await admin.from("exam_submissions").delete().eq("exam_id", exam_id)
      await admin.from("exam_questions").delete().eq("exam_id", exam_id)
      await admin.from("exam_results").delete().eq("exam_id", exam_id)

      // Delete associated notices safely by ID
      if (delete_notices) {
        try {
          const { data: allNotices } = await admin.from("notices").select("id, title, content")
          if (allNotices && allNotices.length > 0) {
            const exTitleClean = (exam.title || "").trim().toLowerCase()
            const toDelete = allNotices
              .filter((n: any) => {
                const t = (n.title || "").toLowerCase()
                const c = (n.content || "").toLowerCase()
                return (exTitleClean && (t.includes(exTitleClean) || c.includes(exTitleClean))) || c.includes(exam_id)
              })
              .map((n: any) => n.id)
            if (toDelete.length > 0) {
              await admin.from("notices").delete().in("id", toDelete)
            }
          }
        } catch (nErr) {
          console.warn("Notice delete error on delete_exam:", nErr)
        }
      }

      // Delete the exam
      const { error: delErr } = await admin.from("exams").delete().eq("id", exam_id)
      if (delErr) throw delErr

      return NextResponse.json({
        success: true,
        message: `পরীক্ষা "${exam.title}" এবং এর সকল ফলাফল সফলভাবে মুছে ফেলা হয়েছে!`,
      })
    }

    if (action === "delete_day" && day_key) {
      const canonicalTarget = getCanonicalDayId(day_key)
      const currentPubDays = parseExistingPubDays(exam)
      const newPubDays = currentPubDays.filter((d) => d !== canonicalTarget)

      let updatedNote = exam.result_note || ""
      updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
      if (newPubDays.length > 0) {
        updatedNote = `${updatedNote} [PUBLISHED_DAYS:${newPubDays.join(",")}]`.trim()
      } else {
        updatedNote = `${updatedNote} [PUBLISHED_DAYS:]`.trim()
      }

      const isWeeklyPub = exam.is_weekly_published === true || updatedNote.includes("[IS_WEEKLY_PUBLISHED:true]")
      const hasLiveCards = newPubDays.length > 0 || isWeeklyPub

      if (!hasLiveCards) {
        updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
        updatedNote = `${updatedNote} [PUBLIC_RESULT:false]`.trim()
      }

      const updated = await safeUpdateExam(admin, exam_id, {
        result_note: updatedNote,
        is_published: hasLiveCards,
        is_public_result: hasLiveCards,
        published_days: newPubDays,
      })

      const dayObj = ALL_WEEK_DAYS.find((d) => d.id === canonicalTarget)
      const label = dayObj ? dayObj.bn : day_key

      // Also safely delete notice for this specific day
      try {
        const { data: allNotices } = await admin.from("notices").select("id, title, content")
        if (allNotices && allNotices.length > 0) {
          const exTitleClean = (exam.title || "").trim().toLowerCase()
          const dayLabelClean = label.trim().toLowerCase()
          const toDelete = allNotices
            .filter((n: any) => {
              const t = (n.title || "").toLowerCase()
              const c = (n.content || "").toLowerCase()
              const matchExam = exTitleClean && (t.includes(exTitleClean) || c.includes(exTitleClean))
              const matchDay = t.includes(dayLabelClean) || c.includes(dayLabelClean)
              return matchExam && matchDay
            })
            .map((n: any) => n.id)
          if (toDelete.length > 0) {
            await admin.from("notices").delete().in("id", toDelete)
          }
        }
      } catch (nErr) {
        console.warn("Notice delete error on delete_day:", nErr)
      }

      return NextResponse.json({
        success: true,
        exam: updated,
        message: `${label} দিনের ফলাফল নোটিফিকেশন সফলভাবে মুছে ফেলা হয়েছে!`,
      })
    }

    if (action === "publish_day" && day_key) {
      const canonicalTarget = getCanonicalDayId(day_key)
      const currentPubDays = parseExistingPubDays(exam)
      const newPubDays = Array.from(new Set([...currentPubDays, canonicalTarget]))

      let updatedNote = exam.result_note || ""
      updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
      updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLISHED_DAYS:${newPubDays.join(",")}] [PUBLIC_RESULT:true]`.trim()

      const updated = await safeUpdateExam(admin, exam_id, {
        result_note: updatedNote,
        is_published: true,
        is_public_result: true,
        published_days: newPubDays,
      })

      const dayObj = ALL_WEEK_DAYS.find((d) => d.id === canonicalTarget)
      const label = dayObj ? dayObj.bn : day_key

      return NextResponse.json({
        success: true,
        exam: updated,
        message: `${label} দিনের ফলাফল নোটিফিকেশন সফলভাবে প্রকাশ করা হয়েছে!`,
      })
    }

    if (action === "toggle_weekly_total") {
      const targetWeeklyPub = Boolean(is_weekly_published)
      const currentPubDays = parseExistingPubDays(exam)

      let updatedNote = exam.result_note || ""
      updatedNote = updatedNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [IS_WEEKLY_PUBLISHED:${targetWeeklyPub}]`.trim()

      const hasLive = targetWeeklyPub || currentPubDays.length > 0
      updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLIC_RESULT:${hasLive}]`.trim()

      const updated = await safeUpdateExam(admin, exam_id, {
        result_note: updatedNote,
        is_published: hasLive,
        is_weekly_published: targetWeeklyPub,
        is_public_result: hasLive,
      })

      return NextResponse.json({
        success: true,
        exam: updated,
        message: targetWeeklyPub
          ? "সাপ্তাহিক সামগ্রিক ফলাফল কার্ড সফলভাবে প্রকাশ করা হয়েছে!"
          : "সাপ্তাহিক সামগ্রিক ফলাফল কার্ড সফলভাবে মুছে ফেলা / হাইড করা হয়েছে!",
      })
    }

    // Default action: UNPUBLISH / DELETE ALL NOTIFICATIONS from homepage and online result portal
    let cleanNote = exam.result_note || ""
    cleanNote = cleanNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
    cleanNote = cleanNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
    cleanNote = cleanNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
    cleanNote = `${cleanNote} [PUBLIC_RESULT:false] [IS_WEEKLY_PUBLISHED:false] [PUBLISHED_DAYS:]`.trim()

    const updated = await safeUpdateExam(admin, exam_id, {
      result_note: cleanNote,
      is_published: false,
      is_public_result: false,
      is_weekly_published: false,
      published_days: [],
    })

    // Safely delete published notices from notice board
    if (delete_notices) {
      try {
        const { data: allNotices } = await admin.from("notices").select("id, title, content")
        if (allNotices && allNotices.length > 0) {
          const exTitleClean = (exam.title || "").trim().toLowerCase()
          const toDelete = allNotices
            .filter((n: any) => {
              const t = (n.title || "").toLowerCase()
              const c = (n.content || "").toLowerCase()
              return (
                (exTitleClean && (t.includes(exTitleClean) || c.includes(exTitleClean))) ||
                c.includes(exam_id) ||
                t.includes(exam_id)
              )
            })
            .map((n: any) => n.id)

          if (toDelete.length > 0) {
            await admin.from("notices").delete().in("id", toDelete)
          }
        }
      } catch (nErr) {
        console.warn("Notice delete error on unpublish:", nErr)
      }
    }

    return NextResponse.json({
      success: true,
      exam: updated,
      message: `পরীক্ষার নোটিফিকেশন ও রেজাল্ট সফলভাবে হোমপেজ ও অনলাইন পোর্টাল থেকে মুছে ফেলা হয়েছে!`,
    })
  } catch (err: any) {
    console.error("Exam unpublish error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
